import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, collection, doc, setDoc, updateDoc,
  deleteDoc, onSnapshot, serverTimestamp, deleteField
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

// ---------- Yardımcılar ----------
const kok = document.getElementById("uygulama");
const para = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sayi = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v ?? "").trim().replace(/\s|₺/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (!/^\d*\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
};
const sayiYaz = (n) => n ? String(Math.round(n * 100) / 100).replace(".", ",") : "";
const sn = (t) => t?.seconds ? t.seconds * 1000 : (typeof t === "number" ? t : 0);
const tarihYaz = (t) => sn(t) ? new Date(sn(t)).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "";
const kisaTarih = (t) => sn(t) ? new Date(sn(t)).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "";
const kucuk = (s) => String(s || "").toLocaleLowerCase("tr");
const sirala = (a, b) => (a.sira ?? 999) - (b.sira ?? 999) || String(a.ad).localeCompare(b.ad, "tr");
const yeniId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const BIRIMLER = ["adet", "kg", "gr", "lt", "paket", "kutu", "demet"];
const ODEMELER = { nakit: "Nakit", banka: "Banka kartı", kredi: "Kredi kartı", kart: "Kart" };
const MAGAZA_TURLERI = { market: "Market", pazar: "Pazar", firin: "Fırın", kasap: "Kasap", eczane: "Eczane", kirtasiye: "Kırtasiye", diger: "Diğer" };

// ---------- Hazır katalog ----------
// Katalog sürümü artınca eksik kategori ve ürünler mevcut veritabanına da bir kez eklenir.
const KATALOG_SURUMU = 2;
const SURUM = "5";
const VARSAYILAN_KATEGORILER = [
  ["meyve-sebze", "Meyve - Sebze", 0], ["et", "Et - Tavuk - Balık", 1], ["sut", "Süt - Kahvaltılık", 2],
  ["temel", "Temel Gıda", 3], ["baharat", "Baharat - Sos", 3.5], ["unlu", "Unlu Mamul", 4], ["icecek", "İçecek", 5],
  ["atistirmalik", "Atıştırmalık - Kuruyemiş", 6], ["dondurulmus", "Dondurulmuş", 6.5], ["temizlik", "Temizlik", 7],
  ["mutfak", "Mutfak Gereçleri", 7.5], ["bakim", "Kişisel Bakım", 8], ["saglik", "Sağlık - Eczane", 8.5],
  ["kirtasiye", "Kırtasiye - Kitap", 9], ["bebek", "Bebek", 10], ["ev", "Ev Eşyası", 11], ["diger", "Diğer", 12]
];
// "Ad:birim" (birim yazılmazsa adet)
const VARSAYILAN_URUNLER = {
  "meyve-sebze": ["Elma:kg", "Armut:kg", "Muz:kg", "Portakal:kg", "Mandalina:kg", "Limon:kg", "Greyfurt:kg", "Nar:kg", "Ayva:kg", "Kivi:kg",
    "Üzüm:kg", "Çilek:kg", "Kiraz:kg", "Şeftali:kg", "Kayısı:kg", "Erik:kg", "İncir:kg", "Karpuz", "Kavun",
    "Domates:kg", "Salatalık:kg", "Biber:kg", "Dolmalık biber:kg", "Kapya biber:kg", "Patlıcan:kg", "Kabak:kg", "Patates:kg",
    "Soğan:kg", "Kuru soğan (file):paket", "Sarımsak:kg", "Taze soğan:demet", "Havuç:kg", "Ispanak:kg", "Pırasa:kg", "Lahana",
    "Karnabahar", "Brokoli", "Marul", "Kıvırcık", "Roka:demet", "Maydanoz:demet", "Dereotu:demet", "Nane:demet",
    "Taze fasulye:kg", "Bezelye:kg", "Mantar:paket", "Turp:kg", "Kereviz:kg", "Pancar:kg", "Mısır"],
  "et": ["Kıyma:kg", "Kuşbaşı:kg", "Antrikot:kg", "Biftek:kg", "Kuzu pirzola:kg", "Kuzu eti:kg", "Kemikli et:kg", "Ciğer:kg",
    "Tavuk:kg", "Tavuk göğsü:kg", "Tavuk but:kg", "Tavuk kanat:kg", "Tavuk baget:kg", "Hazır köfte:kg",
    "Sucuk:paket", "Pastırma:paket", "Salam:paket", "Sosis:paket", "Kavurma:paket",
    "Balık:kg", "Hamsi:kg", "Levrek:kg", "Çipura:kg", "Somon:kg", "Mezgit:kg"],
  "sut": ["Süt:lt", "Ayran:lt", "Kefir:lt", "Yoğurt:kg", "Süzme yoğurt:kg", "Beyaz peynir:kg", "Kaşar peyniri:kg", "Tulum peyniri:kg",
    "Lor peyniri:kg", "Labne:kutu", "Krem peynir:kutu", "Tereyağı:paket", "Margarin:paket", "Kaymak:kutu", "Krema:kutu", "Yumurta",
    "Zeytin:kg", "Siyah zeytin:kg", "Yeşil zeytin:kg", "Bal:kutu", "Reçel:kutu", "Pekmez:kutu", "Tahin:kutu", "Helva:kutu", "Fındık ezmesi:kutu"],
  "temel": ["Un:kg", "Şeker:kg", "Küp şeker:paket", "Tuz:paket", "Pirinç:kg", "Bulgur:kg", "Makarna:paket", "Erişte:paket", "Şehriye:paket",
    "Mercimek:kg", "Yeşil mercimek:kg", "Nohut:kg", "Kuru fasulye:kg", "Barbunya:kg", "Ayçiçek yağı:lt", "Zeytinyağı:lt", "Mısırözü yağı:lt",
    "Salça:kutu", "Biber salçası:kutu", "Çay:paket", "Türk kahvesi:paket", "Hazır kahve:paket", "İrmik:paket", "Nişasta:paket", "Yulaf:paket",
    "Mısır gevreği:paket", "Ton balığı konservesi", "Konserve mısır", "Turşu:kutu", "Hazır çorba:paket", "Kuru maya:paket", "Kabartma tozu:paket",
    "Vanilin:paket", "Sirke:lt", "Kakao:paket", "Pudra şekeri:paket"],
  "baharat": ["Karabiber:paket", "Pul biber:paket", "Toz kırmızı biber:paket", "Kimyon:paket", "Kuru nane:paket", "Kekik:paket", "Sumak:paket",
    "Zerdeçal:paket", "Tarçın:paket", "Köri:paket", "Ketçap", "Mayonez", "Hardal", "Nar ekşisi", "Soya sosu", "Limon sosu"],
  "unlu": ["Ekmek", "Tam buğday ekmeği", "Kepekli ekmek", "Lavaş:paket", "Bazlama", "Simit", "Pide", "Poğaça", "Açma", "Yufka:paket",
    "Galeta:paket", "Kek", "Pasta", "Baklava:kg"],
  "icecek": ["Su", "Damacana su", "Maden suyu", "Meyve suyu:lt", "Gazlı içecek:lt", "Şalgam:lt", "Soğuk çay:lt", "Limonata:lt", "Bitki çayı:paket", "Boza:lt"],
  "atistirmalik": ["Bisküvi:paket", "Kraker:paket", "Çikolata", "Gofret", "Cips:paket", "Kuruyemiş:kg", "Fındık:kg", "Ceviz:kg", "Badem:kg",
    "Antep fıstığı:kg", "Leblebi:kg", "Çekirdek:kg", "Kuru üzüm:kg", "Kuru kayısı:kg", "Kuru incir:kg", "Hurma:kg", "Lokum:kutu", "Sakız:paket"],
  "dondurulmus": ["Dondurulmuş sebze:paket", "Dondurulmuş patates:paket", "Mantı:paket", "Pizza", "Milföy hamuru:paket", "Dondurma"],
  "temizlik": ["Çamaşır deterjanı", "Sıvı çamaşır deterjanı", "Yumuşatıcı", "Leke çıkarıcı", "Bulaşık deterjanı", "Bulaşık makinesi tableti:paket",
    "Parlatıcı", "Makine tuzu:paket", "Yüzey temizleyici", "Çamaşır suyu", "Cam temizleyici", "Kireç çözücü", "Tuvalet kağıdı:paket",
    "Kağıt havlu:paket", "Peçete:paket", "Çöp poşeti:paket", "Bulaşık süngeri:paket", "Temizlik bezi:paket", "Eldiven:paket", "Oda spreyi", "Böcek ilacı"],
  "mutfak": ["Alüminyum folyo", "Streç film", "Pişirme kağıdı", "Buzdolabı poşeti:paket", "Kibrit:paket", "Çakmak", "Mum:paket", "Kürdan:paket"],
  "bakim": ["Diş macunu", "Diş fırçası", "Şampuan", "Saç kremi", "Duş jeli", "Sabun", "Sıvı sabun", "Deodorant", "Tıraş bıçağı:paket",
    "Tıraş köpüğü", "Kolonya", "Pamuk:paket", "Kulak çubuğu:paket", "Hijyenik ped:paket", "El kremi", "Misvak"],
  "saglik": ["Ağrı kesici:kutu", "Yara bandı:kutu", "Vitamin:kutu", "Maske:paket", "El dezenfektanı", "Termometre"],
  "kirtasiye": ["Defter", "Kalem", "Kurşun kalem", "Tükenmez kalem", "Silgi", "Kalemtıraş", "Boya kalemi:kutu", "Pastel boya:kutu", "Cetvel",
    "Yapıştırıcı", "Makas", "A4 kağıt:paket", "Dosya", "Kitap", "Ajanda"],
  "bebek": ["Bebek bezi:paket", "Islak mendil:paket", "Mama:kutu", "Bebek şampuanı", "Pişik kremi", "Biberon", "Emzik"],
  "ev": ["Ampul", "Pil:paket", "Uzatma kablosu", "Koli bandı", "Askı:paket", "Mutfak havlusu", "Paspas"],
  "diger": []
};
const urunKimligi = (kat, ad) => "v_" + kat + "_" + kucuk(ad).replace(/[^a-z0-9çğıöşü]+/g, "-");

let kullanici = null;
let veri = { alisveris: [], urunKategorileri: [], urunler: [], magazalar: [] };
let yuklendi = {};
let sekme = "listeler";
let acikListeId = null;
let yeniOlusturulan = null;
let hata = "";
let dinleyiciler = [];
let tohumlandi = false;
let sunucudan = {};
let katalogBilgisi = null;
const acikKategoriler = new Set();

// ---------- Giriş ----------
onAuthStateChanged(auth, (u) => {
  kullanici = u;
  dinleyiciler.forEach((d) => d()); dinleyiciler = [];
  veri = { alisveris: [], urunKategorileri: [], urunler: [], magazalar: [] };
  yuklendi = {}; sunucudan = {};
  if (!u) { cizGiris(); return; }
  for (const ad of Object.keys(veri)) {
    // includeMetadataChanges: önbellekteki veri sunucudakiyle aynı olsa da "sunucudan geldi" bilgisini alabilmek için
    dinleyiciler.push(onSnapshot(collection(db, ad), { includeMetadataChanges: true }, (s) => {
      veri[ad] = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (ad === "urunKategorileri") { katalogBilgisi = veri[ad].find((k) => k.id === "_katalog") || null; veri[ad] = veri[ad].filter((k) => !k.id.startsWith("_")); }
      yuklendi[ad] = true; hata = "";
      if (!s.metadata?.fromCache) sunucudan[ad] = true; // önbellekten gelen boş liste yanıltmasın
      tohumla(); ciz();
    }, (e) => {
      hata = e.code === "permission-denied"
        ? "Bu listeye erişim izniniz yok. Lütfen izin verilen Gmail hesabıyla giriş yapın."
        : "Bağlantı hatası: " + e.message;
      ciz();
    }));
  }
  ciz();
});

function tohumla() {
  if (tohumlandi || !sunucudan.urunKategorileri || !sunucudan.urunler || !sunucudan.magazalar) return;
  tohumlandi = true;
  if ((katalogBilgisi?.surum || 0) < KATALOG_SURUMU) {
    const kVar = new Set(veri.urunKategorileri.map((k) => k.id));
    const uVar = new Set(veri.urunler.map((u) => u.id));
    for (const [id, ad, sira] of VARSAYILAN_KATEGORILER) {
      if (!kVar.has(id)) setDoc(doc(db, "urunKategorileri", id), { ad, sira }).catch(() => {});
      for (const x of VARSAYILAN_URUNLER[id] || []) {
        const [uad, birim = "adet"] = x.split(":");
        const uid = urunKimligi(id, uad);
        if (!uVar.has(uid)) setDoc(doc(db, "urunler", uid), { ad: uad, kategoriId: id, birim }).catch(() => {});
      }
    }
    setDoc(doc(db, "urunKategorileri", "_katalog"), { surum: KATALOG_SURUMU }).catch(() => {});
  }
  if (!veri.magazalar.length) setDoc(doc(db, "magazalar", "pazar"), { ad: "Pazar yeri", tur: "pazar" }).catch(() => {});
}

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
      <p>Ortak alışveriş listeniz</p><p class="soluk" style="font-size:12px">Sürüm ${SURUM}</p>
      <button id="giris">Google ile giriş yap</button>
    </main>`;
  document.getElementById("giris").onclick = girisYap;
}

// ---------- Veri yardımcıları ----------
const kategoriler = () => [...veri.urunKategorileri].sort(sirala);
const kategoriAdi = (id) => veri.urunKategorileri.find((k) => k.id === id)?.ad || "Diğer";
const magazalar = () => [...veri.magazalar].sort(sirala);
const magazaAdi = (id, yedek) => veri.magazalar.find((m) => m.id === id)?.ad || yedek || "";
const urun = (id) => veri.urunler.find((u) => u.id === id);
// Kalemler belgede "k" alanında kimlik → kalem eşlemesi olarak durur. Her kalem ayrı alan
// olarak yazıldığı için iki kişi aynı anda düzenlese de birbirini ezmez ve internet yokken de çalışır.
const kalemListesi = (l) => l.k ? Object.values(l.k).sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0)) : (l.kalemler || []).map((x, i) => ({ id: x.id || "e" + i, sira: i, ...x }));
const kalemTutari = (k) => sayi(k.fiyat) * (sayi(k.adet) || 1);
const listeToplami = (l) => kalemListesi(l).filter((k) => k.alindi).reduce((t, k) => t + kalemTutari(k), 0);
const bitenler = () => veri.alisveris.filter((l) => l.durum === "bitti").sort((a, b) => sn(b.bitis) - sn(a.bitis));

function fiyatGecmisi(urunId, adi) {
  const out = [];
  for (const l of bitenler()) for (const k of kalemListesi(l)) {
    if (k.alindi && sayi(k.fiyat) && (urunId ? k.urunId === urunId : kucuk(k.ad) === kucuk(adi))) {
      out.push({ tarih: l.bitis, magaza: l.magazaAd || magazaAdi(l.magazaId) || k.magaza || "", fiyat: sayi(k.fiyat), birim: k.birim });
    }
  }
  return out;
}

function hataGoster(e) { alert("Kaydedilemedi: " + e.message); }

function eskiyiTasi(l) {
  // Eski sürümdeki dizi biçimini yeni biçime çevirir.
  if (l.k || !l.kalemler) return {};
  const k = {};
  kalemListesi(l).forEach((x) => { k[x.id] = x; });
  return { k, kalemler: deleteField() };
}
function kalemKaydet(l, kalem) {
  const tasima = eskiyiTasi(l);
  const deg = tasima.k ? { ...tasima, k: { ...tasima.k, [kalem.id]: kalem } } : { ["k." + kalem.id]: kalem };
  return updateDoc(doc(db, "alisveris", l.id), deg).catch(hataGoster);
}
function kalemSil(l, kalem) {
  const tasima = eskiyiTasi(l);
  if (tasima.k) { delete tasima.k[kalem.id]; return updateDoc(doc(db, "alisveris", l.id), tasima).catch(hataGoster); }
  return updateDoc(doc(db, "alisveris", l.id), { ["k." + kalem.id]: deleteField() }).catch(hataGoster);
}
const yeniKalem = (u) => ({ id: yeniId(), sira: Date.now(), urunId: u.id, ad: u.ad, kategoriId: u.kategoriId || "", birim: u.birim || "adet", adet: 1, fiyat: 0, alindi: false });

// ---------- Ekranlar ----------
function ciz() {
  if (!kullanici) return cizGiris();
  const liste = veri.alisveris.find((l) => l.id === acikListeId);
  if (acikListeId && liste) return cizListe(liste);
  if (acikListeId && acikListeId === yeniOlusturulan) { kok.innerHTML = `<p class="bos">Yükleniyor…</p>`; return; }
  acikListeId = null;
  const icerik = hata ? `<div class="hata">${esc(hata)}</div>`
    : !yuklendi.alisveris ? `<p class="bos">Yükleniyor…</p>`
    : sekme === "listeler" ? ekranListeler() : sekme === "urunler" ? ekranUrunler() : ekranMarketler();
  kok.innerHTML = `
    <header><h1>Alışveriş Listesi</h1><button id="cikis">Çıkış</button></header>
    <main>
      <div class="sekmeler">
        <button data-s="listeler" class="${sekme === "listeler" ? "secili" : ""}">Listeler</button>
        <button data-s="urunler" class="${sekme === "urunler" ? "secili" : ""}">Ürünler</button>
        <button data-s="marketler" class="${sekme === "marketler" ? "secili" : ""}">Marketler</button>
      </div>
      ${icerik}
    </main>
    ${hata ? "" : `<button class="yuzen" id="yeni" aria-label="Ekle">+</button>`}`;
  document.getElementById("cikis").onclick = () => signOut(auth);
  kok.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { sekme = b.dataset.s; ciz(); });
  const yeni = document.getElementById("yeni");
  if (yeni) yeni.onclick = () => sekme === "listeler" ? yeniListe() : sekme === "urunler" ? urunPenceresi(null) : magazaPenceresi(null);
  kok.querySelectorAll("[data-liste]").forEach((el) => el.onclick = () => { acikListeId = el.dataset.liste; ciz(); window.scrollTo(0, 0); });
  kok.querySelectorAll("[data-urun]").forEach((el) => el.onclick = () => urunPenceresi(urun(el.dataset.urun)));
  kok.querySelectorAll("[data-ac]").forEach((el) => el.onclick = () => {
    const id = el.dataset.ac;
    acikKategoriler.has(id) ? acikKategoriler.delete(id) : acikKategoriler.add(id);
    ciz();
  });
  kok.querySelectorAll("[data-kategori]").forEach((el) => el.onclick = (e) => e.stopPropagation() || kategoriPenceresi(veri.urunKategorileri.find((k) => k.id === el.dataset.kategori)));
  kok.querySelectorAll("[data-magaza]").forEach((el) => el.onclick = () => magazaPenceresi(veri.magazalar.find((m) => m.id === el.dataset.magaza)));
  const kEkle = document.getElementById("kategori-ekle");
  if (kEkle) kEkle.onclick = () => kategoriPenceresi(null);
}

function ekranListeler() {
  const aciklar = veri.alisveris.filter((l) => l.durum !== "bitti").sort((a, b) => sn(b.olusturma) - sn(a.olusturma));
  const biten = bitenler();
  const ay = new Date(); const buAy = biten.filter((l) => { const d = new Date(sn(l.bitis)); return d.getMonth() === ay.getMonth() && d.getFullYear() === ay.getFullYear(); });
  const ogesi = (l) => {
    const kalemler = kalemListesi(l);
    const alinan = kalemler.filter((k) => k.alindi).length;
    const yer = l.magazaAd || magazaAdi(l.magazaId);
    return `
    <div class="kart liste-ogesi satir" data-liste="${l.id}">
      <div class="esnek">
        <div class="kalin">${esc(l.ad)}</div>
        <div class="soluk">${l.durum === "bitti"
          ? `${kisaTarih(l.bitis)}${yer ? " · " + esc(yer) : ""} · ${ODEMELER[l.odeme] || "Nakit"}`
          : `${alinan}/${kalemler.length} ürün alındı${yer ? " · " + esc(yer) : ""}`}</div>
      </div>
      <div class="tutar kalin">${para.format(l.durum === "bitti" ? (l.toplam || 0) : listeToplami(l))}</div>
    </div>`;
  };
  return `
    ${buAy.length ? `<div class="kart satir"><div class="esnek soluk">${esc(ay.toLocaleDateString("tr-TR", { month: "long" }))} ayı alışverişleri (${buAy.length})</div>
      <div class="kalin tutar">${para.format(buAy.reduce((t, l) => t + sayi(l.toplam), 0))}</div></div>` : ""}
    <h2>Açık listeler</h2>
    ${aciklar.length ? aciklar.map(ogesi).join("") : `<div class="bos">Açık liste yok. Yeni liste için + düğmesine basın.</div>`}
    ${biten.length ? `<h2>Biten alışverişler</h2>${biten.slice(0, 40).map(ogesi).join("")}` : ""}`;
}

function ekranUrunler() {
  const kats = kategoriler();
  const kimsesiz = veri.urunler.filter((u) => !veri.urunKategorileri.some((k) => k.id === u.kategoriId));
  const grup = (k, liste) => {
    const kid = k ? k.id : "_yok";
    const acik = acikKategoriler.has(kid);
    return `
    <div class="kart akordeon ${acik ? "acik" : ""}">
      <div class="satir akordeon-baslik" data-ac="${kid}">
        <span class="ok">${acik ? "▾" : "▸"}</span>
        <span class="esnek kalin">${esc(k ? k.ad : "Kategorisiz")}</span>
        <span class="soluk">${liste.length}</span>
        ${k && acik ? `<button class="ikincil kucuk" data-kategori="${k.id}">Düzenle</button>` : ""}
      </div>
    ${!acik ? "" : liste.length ? `<div class="tablo">${liste.sort(sirala).map((u) => `
      <div class="satir liste-ogesi" data-urun="${u.id}">
        <div class="esnek"><div>${esc(u.ad)}</div>
          ${u.sonFiyat ? `<div class="soluk">Son: ${para.format(u.sonFiyat)}/${esc(u.birim || "adet")}${u.sonMagaza ? " · " + esc(u.sonMagaza) : ""}</div>` : ""}</div>
        <span class="soluk">${esc(u.birim || "adet")}</span>
      </div>`).join("")}</div>` : `<div class="soluk" style="padding:8px 2px 4px">Bu kategoride ürün yok.</div>`}
    </div>`;
  };
  return `
    <p class="soluk" style="margin:0 4px 8px">Sürüm ${SURUM} · Kategoriye dokununca içindeki ürünler açılır. Ürün eklemek için + düğmesine basın. (${veri.urunler.length} ürün)</p>
    ${kats.map((k) => grup(k, veri.urunler.filter((u) => u.kategoriId === k.id))).join("")}
    ${kimsesiz.length ? grup(null, kimsesiz) : ""}
    <button class="ikincil tam" id="kategori-ekle" style="margin-top:14px">+ Yeni kategori</button>`;
}

function ekranMarketler() {
  const biten = bitenler();
  const ms = magazalar();
  return `
    ${ms.length ? ms.map((m) => {
      const alis = biten.filter((l) => l.magazaId === m.id);
      const top = alis.reduce((t, l) => t + sayi(l.toplam), 0);
      return `
      <div class="kart satir liste-ogesi" data-magaza="${m.id}">
        <div class="esnek"><div class="kalin">${esc(m.ad)}</div>
          <div class="soluk">${MAGAZA_TURLERI[m.tur] || "Market"}${alis.length ? ` · ${alis.length} alışveriş · son ${kisaTarih(alis[0].bitis)}` : ""}</div></div>
        <div class="tutar kalin">${alis.length ? para.format(top) : ""}</div>
      </div>`;
    }).join("") : `<div class="bos">Henüz market yok. Eklemek için + düğmesine basın.</div>`}
    <p class="soluk" style="padding:0 4px">Tutarlar o yerden yapılan tüm alışverişlerin toplamıdır.</p>`;
}

// ---------- Liste ekranı ----------
function cizListe(l) {
  const bitti = l.durum === "bitti";
  const kalemler = kalemListesi(l);
  const alinacak = kalemler.filter((k) => !k.alindi);
  const alinan = kalemler.filter((k) => k.alindi);
  const yer = l.magazaAd || magazaAdi(l.magazaId);
  const katSira = (id) => { const k = veri.urunKategorileri.find((x) => x.id === id); return k ? (k.sira ?? 500) : 999; };
  const gruplu = (ks) => {
    const gruplar = {};
    ks.forEach((k) => (gruplar[k.kategoriId || ""] ||= []).push(k));
    return Object.keys(gruplar).sort((a, b) => katSira(a) - katSira(b)).map((kid) => `
      <div class="grup-baslik">${esc(kid ? kategoriAdi(kid) : "Diğer")}</div>
      ${gruplar[kid].map(satir).join("")}`).join("");
  };
  const satir = (k) => `
    <div class="kart satir ${k.alindi ? "alindi" : ""}">
      <input type="checkbox" class="kutu" data-k="${esc(k.id)}" ${k.alindi ? "checked" : ""} ${bitti ? "disabled" : ""}>
      <div class="esnek kalem" data-k="${esc(k.id)}">
        <div class="ad kalin">${esc(k.ad)} <span class="soluk">${esc(sayiYaz(sayi(k.adet) || 1))} ${esc(k.birim || "adet")}</span></div>
        ${k.not ? `<div class="soluk">${esc(k.not)}</div>` : ""}
        ${k.alindi && sayi(k.fiyat) ? `<div class="soluk">${para.format(sayi(k.fiyat))} / ${esc(k.birim || "adet")}</div>` : ""}
      </div>
      <div class="tutar">${k.alindi && sayi(k.fiyat) ? para.format(kalemTutari(k)) : ""}</div>
    </div>`;
  kok.innerHTML = `
    <header><button id="geri">‹</button><h1>${esc(l.ad)}</h1><button id="menu">⋯</button></header>
    <main>
      ${bitti ? `<div class="kart"><span class="rozet">Bitti</span>
          <div class="soluk" style="margin-top:6px">${tarihYaz(l.bitis)}${yer ? " · " + esc(yer) : ""} · ${ODEMELER[l.odeme] || "Nakit"} · ${esc(l.bitiren || "")}</div>
          <div class="toplam" style="margin-top:6px">${para.format(l.toplam || 0)}</div></div>`
        : yer ? `<div class="soluk" style="margin:0 4px 8px">📍 ${esc(yer)}</div>` : ""}
      ${!kalemler.length ? `<div class="bos">Liste boş. Ürün eklemek için + düğmesine basın.</div>` : ""}
      ${alinacak.length ? (bitti ? `<h2>Alınmayanlar</h2>` : "") + gruplu(alinacak) : ""}
      ${alinan.length ? `<h2>Alınanlar</h2>${alinan.map(satir).join("")}` : ""}
      ${!bitti && kalemler.length ? `
        <div class="kart" style="margin-top:14px">
          <div class="satir"><div class="esnek soluk">Alınanların toplamı</div><div class="toplam tutar">${para.format(listeToplami(l))}</div></div>
          <button class="tam" id="bitir" style="margin-top:12px" ${alinan.length ? "" : "disabled"}>Alışverişi bitir</button>
        </div>` : ""}
    </main>
    ${bitti ? "" : `<button class="yuzen" id="ekle" aria-label="Ürün ekle">+</button>`}`;

  document.getElementById("geri").onclick = () => { acikListeId = null; ciz(); };
  document.getElementById("menu").onclick = () => listeMenusu(l);
  if (bitti) return;
  const bul = (key) => kalemler.find((k) => k.id === key);
  document.getElementById("ekle").onclick = () => urunSecici(l);
  const bitir = document.getElementById("bitir");
  if (bitir) bitir.onclick = () => bitirPenceresi(l);
  kok.querySelectorAll("input.kutu").forEach((el) => el.onchange = () => {
    const k = bul(el.dataset.k);
    if (el.checked) { el.checked = false; kalemPenceresi(l, k, true); return; }
    kalemKaydet(l, { ...k, alindi: false });
  });
  kok.querySelectorAll(".kalem").forEach((el) => el.onclick = () => kalemPenceresi(l, bul(el.dataset.k)));
}

function yeniListe() {
  const varsayilan = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long" }) + " alışverişi";
  pencere(`
    <h3>Yeni liste</h3>
    <label>Liste adı</label>
    <input id="ad" value="${esc(varsayilan)}">
    <label>Nereden alışveriş yapılacak? (sonra da seçilebilir)</label>
    ${magazaSec("magaza", "")}
    <div class="dugmeler"><button class="ikincil" data-kapat>Vazgeç</button><button id="tamam">Oluştur</button></div>`,
  (p, kapat) => {
    p.querySelector("#tamam").onclick = () => {
      const ad = p.querySelector("#ad").value.trim() || varsayilan;
      const magazaId = p.querySelector("#magaza").value;
      kapat();
      const ref = doc(collection(db, "alisveris"));
      acikListeId = yeniOlusturulan = ref.id; ciz();
      setDoc(ref, {
        ad, durum: "acik", k: {}, magazaId, magazaAd: magazaAdi(magazaId),
        olusturma: serverTimestamp(), olusturan: kullanici.displayName || kullanici.email
      }).catch((e) => { acikListeId = null; ciz(); hataGoster(e); });
      setTimeout(() => urunSecici({ id: ref.id, k: {} }), 150);
    };
  });
}

function magazaSec(id, secili, bosYazi = "Henüz belli değil") {
  return `<select id="${id}"><option value="">${esc(bosYazi)}</option>${magazalar().map((m) =>
    `<option value="${m.id}" ${m.id === secili ? "selected" : ""}>${esc(m.ad)}</option>`).join("")}</select>`;
}

// Katalogdan ürün seçme: aranır, dokununca listeye eklenir, pencere açık kalır.
function urunSecici(l) {
  let aranan = "";
  const secAcik = new Set();
  pencere(`
    <div class="satir"><h3 class="esnek">Ürün ekle</h3><button class="ikincil" data-kapat>Bitti</button></div>
    <input id="ara" placeholder="Ürün ara ya da yeni ürün yaz" autocomplete="off" style="margin-top:10px">
    <div id="sonuc" style="margin-top:8px"></div>`,
  (p, kapat) => {
    const guncel = () => veri.alisveris.find((x) => x.id === l.id) || l;
    const mevcut = () => kalemListesi(guncel());
    const yaz = () => {
      const q = kucuk(aranan.trim());
      const varIds = new Set(mevcut().map((k) => k.urunId).filter(Boolean));
      const uygun = veri.urunler.filter((u) => !q || kucuk(u.ad).includes(q));
      const tamEslesme = veri.urunler.some((u) => kucuk(u.ad) === q);
      let html = "";

      for (const k of kategoriler()) {
        const us = uygun.filter((u) => u.kategoriId === k.id).sort(sirala);
        if (!us.length) continue;
        const acik = q || secAcik.has(k.id);
        const secilen = us.filter((u) => varIds.has(u.id)).length;
        html += `<div class="kart akordeon ${acik ? "acik" : ""}">
          <div class="satir akordeon-baslik" data-sac="${k.id}"><span class="ok">${acik ? "▾" : "▸"}</span>
            <span class="esnek kalin">${esc(k.ad)}</span>${secilen ? `<span class="rozet">${secilen} seçili</span>` : ""}<span class="soluk">${us.length}</span></div>
          ${acik ? `<div class="cipler" style="margin-top:10px">${us.map((u) =>
          `<button class="cip ${varIds.has(u.id) ? "secili" : ""}" data-u="${u.id}">${varIds.has(u.id) ? "✓ " : ""}${esc(u.ad)}</button>`).join("")}</div>` : ""}</div>`;
      }
      if (q && !tamEslesme) html += `<button class="${html ? "ikincil " : ""}tam" id="yeni-urun" style="margin-top:6px">+ “${esc(aranan.trim())}” yeni ürün olarak ekle</button>`;
      if (!html) html = `<div class="bos">Ürün bulunamadı.</div>`;
      const sonuc = p.querySelector("#sonuc");
      sonuc.innerHTML = html;
      sonuc.querySelectorAll("[data-sac]").forEach((el) => el.onclick = () => {
        const id = el.dataset.sac; secAcik.has(id) ? secAcik.delete(id) : secAcik.add(id); yaz();
      });
      sonuc.querySelectorAll("[data-u]").forEach((b) => b.onclick = () => {
        const u = urun(b.dataset.u);
        const var_ = mevcut().find((x) => x.urunId === u.id && !x.alindi);
        if (varIds.has(u.id)) { if (var_) kalemSil(guncel(), var_); }
        else kalemKaydet(guncel(), yeniKalem(u));
        setTimeout(yaz, 120);
      });
      const yu = sonuc.querySelector("#yeni-urun");
      if (yu) yu.onclick = () => urunPenceresi({ ad: aranan.trim() }, (u) => {
        kalemKaydet(guncel(), yeniKalem(u));
        aranan = ""; p.querySelector("#ara").value = ""; setTimeout(yaz, 150);
      });
    };
    p.querySelector("#ara").oninput = (e) => { aranan = e.target.value; yaz(); };
    yaz();
  });
}

function kalemPenceresi(l, k, alinacak = false) {
  if (!k) return;
  const u = k.urunId ? urun(k.urunId) : null;
  const gecmis = fiyatGecmisi(k.urunId, k.ad).slice(0, 4);
  const onerilen = sayi(k.fiyat) || (u?.sonFiyat ?? 0);
  pencere(`
    <h3>${esc(k.ad)}</h3>
    <div class="satir">
      <div class="esnek"><label>Miktar</label><input id="adet" inputmode="decimal" value="${esc(sayiYaz(sayi(k.adet) || 1))}"></div>
      <div class="esnek"><label>Birim</label><select id="birim">${BIRIMLER.map((b) => `<option ${b === (k.birim || "adet") ? "selected" : ""}>${b}</option>`).join("")}</select></div>
    </div>
    <label>Birim fiyat (₺)</label><input id="fiyat" inputmode="decimal" value="${esc(sayiYaz(onerilen))}" placeholder="0,00">
    <div class="soluk" id="ara-toplam" style="margin-top:6px"></div>
    ${gecmis.length ? `<div class="soluk" style="margin-top:8px">Önceki fiyatlar: ${gecmis.map((g) => `${para.format(g.fiyat)} (${esc(g.magaza || "?")}, ${kisaTarih(g.tarih)})`).join(" · ")}</div>` : ""}
    <label>Not</label><input id="not" value="${esc(k.not || "")}" placeholder="ör. büyük boy, X marka">
    <label class="onay"><input type="checkbox" class="kutu" id="alindi" ${k.alindi || alinacak ? "checked" : ""}> Aldım</label>
    <div class="dugmeler"><button class="tehlike" id="sil">Listeden çıkar</button><button id="tamam">${alinacak ? "Aldım" : "Kaydet"}</button></div>`,
  (p, kapat) => {
    const guncelle = () => {
      const t = sayi(p.querySelector("#fiyat").value) * (sayi(p.querySelector("#adet").value) || 1);
      p.querySelector("#ara-toplam").textContent = t ? "Tutar: " + para.format(t) : "";
    };
    p.querySelector("#fiyat").oninput = guncelle; p.querySelector("#adet").oninput = guncelle; guncelle();
    if (alinacak) setTimeout(() => { const f = p.querySelector("#fiyat"); f.focus(); f.select(); }, 60);
    p.querySelector("#tamam").onclick = () => {
      const alindi = p.querySelector("#alindi").checked;
      const fiyat = sayi(p.querySelector("#fiyat").value);
      if (alindi && !fiyat && !confirm("Fiyat girmediniz. Fiyatsız olarak işaretlensin mi?")) return;
      const yeni = { ...k, adet: sayi(p.querySelector("#adet").value) || 1, birim: p.querySelector("#birim").value, fiyat, not: p.querySelector("#not").value.trim(), alindi };
      kapat();
      kalemKaydet(l, yeni);
    };
    p.querySelector("#sil").onclick = () => { kapat(); kalemSil(l, k); };
  });
}

function bitirPenceresi(l) {
  const toplam = listeToplami(l);
  const alinmayan = kalemListesi(l).filter((k) => !k.alindi).length;
  let odeme = "nakit";
  pencere(`
    <h3>Alışverişi bitir</h3>
    <div class="soluk">Alınan ürünlerin toplamı</div>
    <div class="toplam" style="margin:4px 0 10px">${para.format(toplam)}</div>
    ${alinmayan ? `<div class="uyari">${alinmayan} ürün alınmadı. Bunlar toplama katılmaz.</div>` : ""}
    <label>Nereden alındı?</label>
    ${magazaSec("magaza", l.magazaId, "Seçin…")}
    <input id="yeni-magaza" placeholder="Listede yoksa yeni yer adı yazın" style="margin-top:8px">
    <label>Ödeme şekli</label>
    <div class="secenekler">${["nakit", "banka", "kredi"].map((o) => `<button data-o="${o}" class="${o === odeme ? "secili" : ""}">${ODEMELER[o]}</button>`).join("")}</div>
    <div class="dugmeler"><button class="ikincil" data-kapat>Vazgeç</button><button id="tamam">Bitir</button></div>`,
  (p, kapat) => {
    p.querySelectorAll("[data-o]").forEach((b) => b.onclick = () => {
      odeme = b.dataset.o;
      p.querySelectorAll("[data-o]").forEach((x) => x.classList.toggle("secili", x === b));
    });
    p.querySelector("#tamam").onclick = () => {
      let magazaId = p.querySelector("#magaza").value;
      const yeniAd = p.querySelector("#yeni-magaza").value.trim();
      if (!magazaId && !yeniAd) { alert("Alışverişin nereden yapıldığını seçin ya da yazın."); return; }
      if (yeniAd) {
        const ref = doc(collection(db, "magazalar"));
        magazaId = ref.id;
        setDoc(ref, { ad: yeniAd, tur: /pazar/i.test(yeniAd) ? "pazar" : "market" }).catch(hataGoster);
      }
      const magazaAd = yeniAd || magazaAdi(magazaId);
      const magazaTur = yeniAd ? (/pazar/i.test(yeniAd) ? "pazar" : "market") : (veri.magazalar.find((m) => m.id === magazaId)?.tur || "market");
      kapat();
      const guncel = veri.alisveris.find((x) => x.id === l.id) || l;
      const alinanlar = kalemListesi(guncel).filter((k) => k.alindi);
      updateDoc(doc(db, "alisveris", l.id), {
        durum: "bitti", odeme, magazaId, magazaAd, magazaTur,
        toplam: Math.round(listeToplami(guncel) * 100) / 100,
        bitis: serverTimestamp(), bitiren: kullanici.displayName || kullanici.email
      }).catch(hataGoster);
      // Ürünlerin son fiyatını güncelle
      for (const k of alinanlar) if (k.urunId && sayi(k.fiyat) && urun(k.urunId)) {
        updateDoc(doc(db, "urunler", k.urunId), { sonFiyat: sayi(k.fiyat), sonMagaza: magazaAd, birim: k.birim || "adet" }).catch(() => {});
      }
    };
  });
}

function listeMenusu(l) {
  pencere(`
    <h3>Liste ayarları</h3>
    <label>Liste adı</label><input id="ad" value="${esc(l.ad)}">
    <label>Nereden</label>${magazaSec("magaza", l.magazaId)}
    ${l.durum === "bitti" ? `<button class="ikincil tam" id="yeniden" style="margin-top:14px">Alışverişi yeniden aç</button>
      <div class="soluk" style="margin-top:6px">Yeniden açarsanız ürünleri düzeltip tekrar bitirebilirsiniz. Hesap Defteri'ndeki gider de buna göre güncellenir.</div>` : ""}
    <div class="dugmeler"><button class="tehlike" id="sil">${l.durum === "bitti" ? "Alışverişi sil" : "Listeyi sil"}</button><button id="tamam">Kaydet</button></div>`,
  (p, kapat) => {
    const yeniden = p.querySelector("#yeniden");
    if (yeniden) yeniden.onclick = () => {
      kapat();
      updateDoc(doc(db, "alisveris", l.id), { durum: "acik", toplam: deleteField(), bitis: deleteField(), odeme: deleteField(), bitiren: deleteField() }).catch(hataGoster);
    };
    p.querySelector("#tamam").onclick = () => {
      const ad = p.querySelector("#ad").value.trim() || l.ad;
      const magazaId = p.querySelector("#magaza").value;
      kapat();
      updateDoc(doc(db, "alisveris", l.id), { ad, magazaId, magazaAd: magazaAdi(magazaId) }).catch(hataGoster);
    };
    p.querySelector("#sil").onclick = async () => {
      if (!confirm(l.durum === "bitti" ? "Bu alışveriş silinsin mi? Hesap Defteri'ndeki gideri de kaldırılır." : "Bu liste tamamen silinsin mi?")) return;
      kapat(); acikListeId = null; ciz();
      deleteDoc(doc(db, "alisveris", l.id)).catch(hataGoster);
    };
  });
}

// ---------- Katalog pencereleri ----------
function urunPenceresi(u, sonra) {
  const yeni = !u?.id;
  u = { ad: "", kategoriId: kategoriler()[0]?.id || "", birim: "adet", ...u };
  const gecmis = yeni ? [] : fiyatGecmisi(u.id, u.ad).slice(0, 6);
  pencere(`
    <h3>${yeni ? "Yeni ürün" : "Ürünü düzenle"}</h3>
    <label>Ürün adı</label><input id="ad" value="${esc(u.ad)}" placeholder="ör. Elma">
    <label>Kategori</label><select id="kategori">${kategoriler().map((k) => `<option value="${k.id}" ${k.id === u.kategoriId ? "selected" : ""}>${esc(k.ad)}</option>`).join("")}</select>
    <label>Birim</label><select id="birim">${BIRIMLER.map((b) => `<option ${b === u.birim ? "selected" : ""}>${b}</option>`).join("")}</select>
    ${gecmis.length ? `<h2 style="margin-left:0">Fiyat geçmişi</h2>${gecmis.map((g) => `<div class="satir soluk"><span class="esnek">${kisaTarih(g.tarih)} · ${esc(g.magaza)}</span><span class="tutar">${para.format(g.fiyat)}/${esc(g.birim || u.birim)}</span></div>`).join("")}` : ""}
    <div class="dugmeler">
      ${yeni ? `<button class="ikincil" data-kapat>Vazgeç</button>` : `<button class="tehlike" id="sil">Sil</button>`}
      <button id="tamam">Kaydet</button>
    </div>`,
  (p, kapat) => {
    if (yeni) setTimeout(() => p.querySelector("#ad").focus(), 60);
    p.querySelector("#tamam").onclick = () => {
      const ad = p.querySelector("#ad").value.trim();
      if (!ad) { p.querySelector("#ad").focus(); return; }
      const v = { ad, kategoriId: p.querySelector("#kategori").value, birim: p.querySelector("#birim").value };
      kapat();
      const ref = yeni ? doc(collection(db, "urunler")) : doc(db, "urunler", u.id);
      (yeni ? setDoc(ref, v) : updateDoc(ref, v)).catch(hataGoster);
      if (sonra) sonra({ id: ref.id, ...v });
    };
    const sil = p.querySelector("#sil");
    if (sil) sil.onclick = () => {
      if (!confirm(`"${u.ad}" ürünü silinsin mi? Geçmiş alışverişler etkilenmez.`)) return;
      kapat(); deleteDoc(doc(db, "urunler", u.id)).catch(hataGoster);
    };
  });
}

function kategoriPenceresi(k) {
  const yeni = !k;
  k = k || { ad: "" };
  pencere(`
    <h3>${yeni ? "Yeni kategori" : "Kategoriyi düzenle"}</h3>
    <label>Kategori adı</label><input id="ad" value="${esc(k.ad)}" placeholder="ör. Kırtasiye">
    ${yeni ? "" : `<div class="satir" style="margin-top:12px"><button class="ikincil esnek" id="yukari">▲ Yukarı</button><button class="ikincil esnek" id="asagi">▼ Aşağı</button></div>`}
    <div class="dugmeler">
      ${yeni ? `<button class="ikincil" data-kapat>Vazgeç</button>` : `<button class="tehlike" id="sil">Sil</button>`}
      <button id="tamam">Kaydet</button>
    </div>`,
  (p, kapat) => {
    p.querySelector("#tamam").onclick = () => {
      const ad = p.querySelector("#ad").value.trim();
      if (!ad) return;
      kapat();
      if (yeni) setDoc(doc(collection(db, "urunKategorileri")), { ad, sira: veri.urunKategorileri.length }).catch(hataGoster);
      else updateDoc(doc(db, "urunKategorileri", k.id), { ad }).catch(hataGoster);
    };
    const tasi = (yon) => {
      const s = kategoriler(); const i = s.findIndex((x) => x.id === k.id); const j = i + yon;
      if (j < 0 || j >= s.length) return;
      [s[i], s[j]] = [s[j], s[i]];
      s.forEach((x, n) => { if (x.sira !== n) updateDoc(doc(db, "urunKategorileri", x.id), { sira: n }).catch(() => {}); });
    };
    if (!yeni) {
      p.querySelector("#yukari").onclick = () => tasi(-1);
      p.querySelector("#asagi").onclick = () => tasi(1);
      p.querySelector("#sil").onclick = () => {
        if (veri.urunler.some((u) => u.kategoriId === k.id)) { alert("Bu kategoride ürünler var. Önce ürünleri başka kategoriye taşıyın ya da silin."); return; }
        if (!confirm(`"${k.ad}" kategorisi silinsin mi?`)) return;
        kapat(); deleteDoc(doc(db, "urunKategorileri", k.id)).catch(hataGoster);
      };
    }
  });
}

function magazaPenceresi(m) {
  const yeni = !m;
  m = m || { ad: "", tur: "market", adres: "" };
  let tur = m.tur || "market";
  pencere(`
    <h3>${yeni ? "Yeni market / yer" : "Düzenle"}</h3>
    <label>Adı</label><input id="ad" value="${esc(m.ad)}" placeholder="ör. BİM Meram, Salı pazarı">
    <label>Türü</label>
    <div class="cipler">${Object.entries(MAGAZA_TURLERI).map(([k, v]) => `<button class="cip ${k === tur ? "secili" : ""}" data-t="${k}">${v}</button>`).join("")}</div>
    <label>Adres / not</label><input id="adres" value="${esc(m.adres || "")}" placeholder="isteğe bağlı">
    <div class="dugmeler">
      ${yeni ? `<button class="ikincil" data-kapat>Vazgeç</button>` : `<button class="tehlike" id="sil">Sil</button>`}
      <button id="tamam">Kaydet</button>
    </div>`,
  (p, kapat) => {
    p.querySelectorAll("[data-t]").forEach((b) => b.onclick = () => {
      tur = b.dataset.t;
      p.querySelectorAll("[data-t]").forEach((x) => x.classList.toggle("secili", x === b));
    });
    p.querySelector("#tamam").onclick = () => {
      const ad = p.querySelector("#ad").value.trim();
      if (!ad) return;
      const v = { ad, tur, adres: p.querySelector("#adres").value.trim() };
      kapat();
      if (yeni) setDoc(doc(collection(db, "magazalar")), v).catch(hataGoster);
      else updateDoc(doc(db, "magazalar", m.id), v).catch(hataGoster);
    };
    const sil = p.querySelector("#sil");
    if (sil) sil.onclick = () => {
      if (!confirm(`"${m.ad}" silinsin mi? Geçmiş alışverişlerde adı kalır.`)) return;
      kapat(); deleteDoc(doc(db, "magazalar", m.id)).catch(hataGoster);
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
