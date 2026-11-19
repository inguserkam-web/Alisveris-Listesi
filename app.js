import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, collection, doc, updateDoc,
  deleteDoc, setDoc, onSnapshot, query, orderBy, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

const kok = document.getElementById("uygulama");
const para = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const tarihYaz = (t) => t ? new Date(t.seconds ? t.seconds * 1000 : t).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sayi = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v ?? "").trim().replace(/\s|₺/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (!/^\d*\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
};
const sayiYaz = (n) => n ? String(n).replace(".", ",") : "";

let kullanici = null;
let listeler = [];
let acikListeId = null;
let hata = "";
let dinleyici = null;
let yeniOlusturulan = null;

// ---------- Giriş ----------
onAuthStateChanged(auth, (u) => {
  kullanici = u;
  if (dinleyici) { dinleyici(); dinleyici = null; }
  if (!u) { cizGiris(); return; }
  const q = query(collection(db, "alisveris"), orderBy("olusturma", "desc"));
  dinleyici = onSnapshot(q, (snap) => {
    hata = "";
    listeler = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    ciz();
  }, (e) => {
    hata = e.code === "permission-denied"
      ? "Bu listeye erişim izniniz yok. Lütfen izin verilen Gmail hesabıyla giriş yapın."
      : "Bağlantı hatası: " + e.message;
    ciz();
  });
  ciz();
});

async function girisYap() {
  const saglayici = new GoogleAuthProvider();
  saglayici.setCustomParameters({ prompt: "select_account" });
  try { await signInWithPopup(auth, saglayici); }
  catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, saglayici);
    } else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
      alert("Giriş yapılamadı: " + e.message);
    }
  }
}

function cizGiris() {
  kok.innerHTML = `
    <main class="giris">
      <img src="icons/icon-192.png" alt="">
      <h1>Alışveriş Listesi</h1>
      <p>Ortak alışveriş listeniz</p>
      <button id="giris">Google ile giriş yap</button>
    </main>`;
  document.getElementById("giris").onclick = girisYap;
}

// ---------- Hesaplamalar ----------
const kalemTutari = (k) => sayi(k.fiyat) * (sayi(k.adet) || 1);
const listeToplami = (l) => (l.kalemler || []).filter((k) => k.alindi).reduce((t, k) => t + kalemTutari(k), 0);

function kaydet(liste, degisiklik) {
  return updateDoc(doc(db, "alisveris", liste.id), degisiklik).catch((e) => alert("Kaydedilemedi: " + e.message));
}
const yeniId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
// İki kişi aynı anda düzenlese de değişiklikler birbirini ezmesin diye en güncel listeye uygulanır.
function kalemleriGuncelle(liste, fn) {
  const ref = doc(db, "alisveris", liste.id);
  return runTransaction(db, async (t) => {
    const s = await t.get(ref);
    if (!s.exists()) return;
    if (s.data().durum === "bitti") throw new Error("Bu alışveriş bitmiş.");
    t.update(ref, { kalemler: fn(s.data().kalemler || []) });
  }).catch((e) => alert("Kaydedilemedi: " + e.message));
}

// ---------- Ekranlar ----------
function ciz() {
  if (!kullanici) return cizGiris();
  const liste = listeler.find((l) => l.id === acikListeId);
  if (acikListeId && liste) cizListe(liste);
  else if (acikListeId && acikListeId === yeniOlusturulan) kok.innerHTML = `<p class="bos">Yükleniyor…</p>`;
  else { acikListeId = null; cizAna(); }
}

function cizAna() {
  const aciklar = listeler.filter((l) => l.durum !== "bitti");
  const bitenler = listeler.filter((l) => l.durum === "bitti");
  const ogesi = (l) => {
    const kalemler = l.kalemler || [];
    const alinan = kalemler.filter((k) => k.alindi).length;
    return `
    <div class="kart liste-ogesi satir" data-id="${l.id}">
      <div class="esnek">
        <div class="kalin">${esc(l.ad)}</div>
        <div class="soluk">${l.durum === "bitti"
          ? `${tarihYaz(l.bitis)} · ${l.odeme === "kart" ? "Kart" : "Nakit"}`
          : `${alinan}/${kalemler.length} ürün alındı`}</div>
      </div>
      <div class="tutar kalin">${para.format(l.durum === "bitti" ? (l.toplam || 0) : listeToplami(l))}</div>
    </div>`;
  };
  kok.innerHTML = `
    <header><h1>Alışveriş Listesi</h1><button id="cikis">Çıkış</button></header>
    <main>
      ${hata ? `<div class="hata">${esc(hata)}</div>` : ""}
      <h2>Açık listeler</h2>
      ${aciklar.length ? aciklar.map(ogesi).join("") : `<div class="bos">Açık liste yok. Yeni liste için + düğmesine basın.</div>`}
      ${bitenler.length ? `<h2>Biten alışverişler</h2>${bitenler.map(ogesi).join("")}` : ""}
    </main>
    <button class="yuzen" id="yeni" aria-label="Yeni liste">+</button>`;
  document.getElementById("cikis").onclick = () => signOut(auth);
  document.getElementById("yeni").onclick = yeniListe;
  kok.querySelectorAll(".liste-ogesi").forEach((el) => el.onclick = () => { acikListeId = el.dataset.id; ciz(); window.scrollTo(0, 0); });
}

function yeniListe() {
  const varsayilan = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) + " alışverişi";
  pencere(`
    <h3>Yeni liste</h3>
    <label>Liste adı</label>
    <input id="ad" value="${esc(varsayilan)}">
    <div class="dugmeler"><button class="ikincil" data-kapat>Vazgeç</button><button id="tamam">Oluştur</button></div>`,
  (p, kapat) => {
    p.querySelector("#tamam").onclick = async () => {
      const ad = p.querySelector("#ad").value.trim() || varsayilan;
      kapat();
      const ref = doc(collection(db, "alisveris"));
      acikListeId = yeniOlusturulan = ref.id; ciz();
      setDoc(ref, {
        ad, durum: "acik", kalemler: [], olusturma: serverTimestamp(),
        olusturan: kullanici.displayName || kullanici.email
      }).catch((e) => { acikListeId = null; ciz(); alert("Liste oluşturulamadı: " + e.message); });
    };
  });
}

function cizListe(l) {
  const bitti = l.durum === "bitti";
  const kalemler = l.kalemler || [];
  const sirali = kalemler.map((k, i) => ({ ...k, i })).sort((a, b) => (a.alindi ? 1 : 0) - (b.alindi ? 1 : 0));
  kok.innerHTML = `
    <header><button id="geri">‹ Geri</button><h1>${esc(l.ad)}</h1>${bitti ? "" : `<button id="menu">⋯</button>`}</header>
    <main>
      ${bitti ? `<div class="kart"><span class="rozet">Bitti</span>
          <div class="soluk" style="margin-top:6px">${tarihYaz(l.bitis)} · ${l.odeme === "kart" ? "Kartla ödendi" : "Nakit ödendi"} · ${esc(l.bitiren || "")}</div>
          <div class="toplam" style="margin-top:6px">${para.format(l.toplam || 0)}</div></div>` : ""}
      ${kalemler.length ? sirali.map((k) => `
        <div class="kart satir ${k.alindi ? "alindi" : ""}">
          <input type="checkbox" class="kutu" data-i="${k.i}" ${k.alindi ? "checked" : ""} ${bitti ? "disabled" : ""}>
          <div class="esnek kalem" data-i="${k.i}">
            <div class="ad kalin">${esc(k.ad)}${sayi(k.adet) > 1 ? ` <span class="soluk">× ${esc(sayiYaz(k.adet))}</span>` : ""}</div>
            ${k.magaza ? `<div class="soluk">${esc(k.magaza)}</div>` : ""}
          </div>
          <div class="tutar">${sayi(k.fiyat) ? para.format(kalemTutari(k)) : `<span class="soluk">—</span>`}</div>
        </div>`).join("") : `<div class="bos">Liste boş. Ürün eklemek için + düğmesine basın.</div>`}
      ${!bitti ? `
        <div class="kart">
          <div class="satir"><div class="esnek soluk">Alınanların toplamı</div><div class="toplam tutar">${para.format(listeToplami(l))}</div></div>
          <button class="tam" id="bitir" style="margin-top:12px" ${kalemler.some((k) => k.alindi) ? "" : "disabled"}>Alışverişi bitir</button>
        </div>` : ""}
    </main>
    ${bitti ? "" : `<button class="yuzen" id="ekle" aria-label="Ürün ekle">+</button>`}`;

  document.getElementById("geri").onclick = () => { acikListeId = null; ciz(); };
  if (bitti) return;
  document.getElementById("ekle").onclick = () => kalemPenceresi(l, null);
  document.getElementById("bitir").onclick = () => bitirPenceresi(l);
  document.getElementById("menu").onclick = () => listeMenusu(l);
  kok.querySelectorAll("input.kutu").forEach((el) => el.onchange = () => {
    const i = +el.dataset.i;
    const k = kalemler[i];
    if (el.checked && !sayi(k.fiyat)) { el.checked = false; kalemPenceresi(l, i, true); return; }
    const alindi = el.checked;
    kalemleriGuncelle(l, (ks) => ks.map((x) => (x.id ? x.id === k.id : x.ad === k.ad) ? { ...x, alindi } : x));
  });
  kok.querySelectorAll(".kalem").forEach((el) => el.onclick = () => kalemPenceresi(l, +el.dataset.i));
}

function kalemPenceresi(l, i, alinacak = false) {
  const kalemler = l.kalemler || [];
  const k = i === null ? { ad: "", adet: 1, fiyat: "", magaza: "", alindi: false } : kalemler[i];
  const magazalar = [...new Set(listeler.flatMap((x) => (x.kalemler || []).map((y) => y.magaza)).filter(Boolean))];
  pencere(`
    <h3>${i === null ? "Ürün ekle" : alinacak ? "Fiyatı girin" : "Ürünü düzenle"}</h3>
    <label>Ürün</label><input id="ad" value="${esc(k.ad)}" placeholder="ör. Süt">
    <div class="satir">
      <div class="esnek"><label>Adet / miktar</label><input id="adet" inputmode="decimal" value="${esc(sayiYaz(k.adet))}"></div>
      <div class="esnek"><label>Birim fiyat (₺)</label><input id="fiyat" inputmode="decimal" value="${esc(sayiYaz(k.fiyat))}" placeholder="0,00"></div>
    </div>
    <label>Nereden</label><input id="magaza" list="magazalar" value="${esc(k.magaza)}" placeholder="ör. BİM, pazar">
    <datalist id="magazalar">${magazalar.map((m) => `<option value="${esc(m)}">`).join("")}</datalist>
    ${i === null ? "" : `<label style="display:flex;gap:10px;align-items:center;color:inherit;margin-top:14px"><input type="checkbox" class="kutu" id="alindi" ${k.alindi || alinacak ? "checked" : ""}> Alındı</label>`}
    <div class="dugmeler">
      ${i === null ? `<button class="ikincil" data-kapat>Vazgeç</button>` : `<button class="tehlike" id="sil">Sil</button>`}
      <button id="tamam">Kaydet</button>
    </div>`,
  (p, kapat) => {
    const odak = alinacak ? p.querySelector("#fiyat") : p.querySelector("#ad");
    setTimeout(() => odak.focus(), 50);
    p.querySelector("#tamam").onclick = () => {
      const ad = p.querySelector("#ad").value.trim();
      if (!ad) { p.querySelector("#ad").focus(); return; }
      const yeniKalem = {
        id: k.id || yeniId(),
        ad,
        adet: sayi(p.querySelector("#adet").value) || 1,
        fiyat: sayi(p.querySelector("#fiyat").value),
        magaza: p.querySelector("#magaza").value.trim(),
        alindi: i === null ? false : p.querySelector("#alindi").checked
      };
      kapat();
      kalemleriGuncelle(l, (ks) => i === null ? [...ks, yeniKalem] : ks.map((x) => (x.id ? x.id === k.id : x.ad === k.ad) ? yeniKalem : x));
    };
    const sil = p.querySelector("#sil");
    if (sil) sil.onclick = () => {
      if (!confirm(`"${k.ad}" silinsin mi?`)) return;
      kapat();
      kalemleriGuncelle(l, (ks) => ks.filter((x) => !(x.id ? x.id === k.id : x.ad === k.ad)));
    };
  });
}

function bitirPenceresi(l) {
  const toplam = listeToplami(l);
  const alinmayan = (l.kalemler || []).filter((k) => !k.alindi).length;
  let odeme = "kart";
  pencere(`
    <h3>Alışverişi bitir</h3>
    <div class="soluk">Alınan ürünlerin toplamı</div>
    <div class="toplam" style="margin:4px 0 14px">${para.format(toplam)}</div>
    ${alinmayan ? `<div class="uyari">${alinmayan} ürün alınmadı olarak işaretli. Bunlar toplama katılmaz.</div>` : ""}
    <label>Ödeme şekli</label>
    <div class="secenekler"><button data-o="nakit">Nakit</button><button data-o="kart" class="secili">Kart</button></div>
    <div class="dugmeler"><button class="ikincil" data-kapat>Vazgeç</button><button id="tamam">Bitir</button></div>`,
  (p, kapat) => {
    p.querySelectorAll("[data-o]").forEach((b) => b.onclick = () => {
      odeme = b.dataset.o;
      p.querySelectorAll("[data-o]").forEach((x) => x.classList.toggle("secili", x === b));
    });
    p.querySelector("#tamam").onclick = () => {
      kapat();
      const ref = doc(db, "alisveris", l.id);
      runTransaction(db, async (t) => {
        const s = await t.get(ref);
        if (!s.exists() || s.data().durum === "bitti") return;
        const guncel = listeToplami(s.data());
        t.update(ref, {
          durum: "bitti", odeme, toplam: Math.round(guncel * 100) / 100,
          bitis: serverTimestamp(), bitiren: kullanici.displayName || kullanici.email
        });
      }).catch((e) => alert("Kaydedilemedi: " + e.message));
    };
  });
}

function listeMenusu(l) {
  pencere(`
    <h3>${esc(l.ad)}</h3>
    <label>Liste adı</label><input id="ad" value="${esc(l.ad)}">
    <div class="dugmeler"><button class="tehlike" id="sil">Listeyi sil</button><button id="tamam">Kaydet</button></div>`,
  (p, kapat) => {
    p.querySelector("#tamam").onclick = () => {
      const ad = p.querySelector("#ad").value.trim();
      kapat();
      if (ad && ad !== l.ad) kaydet(l, { ad });
    };
    p.querySelector("#sil").onclick = async () => {
      if (!confirm("Bu liste tamamen silinsin mi?")) return;
      kapat(); acikListeId = null;
      try { await deleteDoc(doc(db, "alisveris", l.id)); } catch (e) { alert("Silinemedi: " + e.message); }
    };
  });
}

// ---------- Alt pencere ----------
function pencere(html, kur) {
  const perde = document.createElement("div");
  perde.className = "perde";
  perde.innerHTML = `<div class="pencere">${html}</div>`;
  const kapat = () => perde.remove();
  perde.onclick = (e) => { if (e.target === perde) kapat(); };
  perde.querySelectorAll("[data-kapat]").forEach((b) => b.onclick = kapat);
  document.body.appendChild(perde);
  kur(perde, kapat);
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
