(function () {
  // =======================================================
  // KUNCI API SUPABASE ANDA
  // =======================================================
  // 1. Initialize Supabase
  const supabaseUrl = 'https://pqukdhyuxhitusvbevnc.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdWtkaHl1eGhpdHVzdmJldm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1NDMxMjIsImV4cCI6MjEwODExOTEyMn0.A8oIrN8W05OG_91PRGO1GRMGfVRQJguBEQu6Ym43Dq8';
  const sb = window.supabase.createClient(supabaseUrl, supabaseKey);
  
  // Kategori Khas Untuk Sektor Perancangan
  const CATEGORIES = [
    "Data & Unjuran Sekolah",
    "Pelan Strategik & Pemantauan",
    "Infrastruktur & Pembangunan"
  ];

  const root = document.getElementById("spm-app");
  let view = { screen: "home" };
  let resources = [];
  let searchQuery = "";
  let editingResource = null;
  let pendingDeleteId = null;

  // ---------- Dialog Helpers ----------
  window.showSiscAlert = msg => { document.getElementById("siscAlertText").innerText = msg; document.getElementById("siscSystemAlert").classList.add("show"); };
  window.closeSiscAlert = () => document.getElementById("siscSystemAlert").classList.remove("show");
  window.requestDeleteResource = id => { pendingDeleteId = id; document.getElementById("siscConfirmModal").classList.add("show"); };
  window.closeConfirmModal = () => { pendingDeleteId = null; document.getElementById("siscConfirmModal").classList.remove("show"); };

  window.executeDelete = async () => {
    if (!pendingDeleteId) return;
    window.closeConfirmModal();
    const { error } = await sb.from("resources").delete().eq("id", pendingDeleteId);
    if (error) { showSiscAlert("Gagal memadam: " + error.message); return; }
    await loadResources(view.category);
    render();
  };

  function getDriveThumbnailUrl(driveUrl) {
    if (!driveUrl) return null;
    const match = driveUrl.match(/[?&]id=([^&]+)/) || driveUrl.match(/\/d\/([^/]+)/);
    return (match && match[1]) ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w600` : null;
  }

  // ---------- Database ----------
  async function loadResources(category) {
    const { data, error } = await sb.from("resources").select("*").eq("category", category).order("created_at", { ascending: false });
    if (error) { showSiscAlert("Ralat pangkalan data."); return; }
    resources = data;
  }

async function saveResource(fields) {
  const payload = { 
    category: view.category, 
    title: fields.title, 
    link: fields.link, 
    year: fields.year ? Number(fields.year) : null, 
    uploaded_by: fields.author || "Staf Perancangan" 
  };

  if (editingResource) {
    const { error } = await sb.from("resources").update(payload).eq("id", editingResource.id);
    if (error) { showSiscAlert("Gagal kemaskini."); return; }
  } else {
    // Added .select() so Supabase returns the new row with its auto-generated 'id'
    const { data, error } = await sb.from("resources").insert(payload).select();
    if (error) { showSiscAlert("Gagal menambah."); return; }
  }

  editingResource = null;
  await loadResources(view.category);
  render();
}

  // ---------- Navigation ----------
  window.__spmGoHome = () => { view = { screen: "home" }; render(); };
  window.__spmGoCategory = async (cat) => { view = { screen: "dashboard", category: cat }; searchQuery = ""; render(); await loadResources(cat); render(); };
  window.__spmOnSearch = val => { searchQuery = val; render(); };
  window.__spmOpenModal = () => { editingResource = null; view.showModal = true; render(); };
  window.__spmCloseModal = () => { view.showModal = false; render(); };
  window.__spmEdit = id => { editingResource = resources.find(r => String(r.id) === String(id)); view.showModal = true; render(); };
  window.__spmSaveModal = () => {
    const title = document.getElementById("f-title").value.trim(), link = document.getElementById("f-link").value.trim();
    if (!title || !link) return showSiscAlert("Sila isi tajuk dan pautan.");
    saveResource({ title, link, author: document.getElementById("f-author").value.trim(), year: document.getElementById("f-year").value.trim() });
    view.showModal = false;
  };

  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

  // ---------- UI Renders ----------
  function header() {
    return `<header class="header">
      <!-- Image Slides -->
      <div class="carousel-slide" style="background-image: url('bg-1.jpg'); animation-delay: 0s;"></div>
      <div class="carousel-slide" style="background-image: url('bg-2.jpg'); animation-delay: 5s;"></div>
      <div class="carousel-slide" style="background-image: url('bg-3.jpg'); animation-delay: 10s;"></div>
      
      <!-- Blue Gradient Overlay -->
      <div class="carousel-overlay"></div>
      
      <!-- Logo and Text -->
      <div class="header-content">
        <img src="logo-ppd.png" alt="Logo Rasmi PPD Muar" class="header-logo">
        <h1>SEKTOR PERANCANGAN</h1>
        <p>Pejabat Pendidikan Daerah Muar</p>
      </div>
    </header>`;
  }

  function crumb() {
    if (view.screen === "home") return "";
    return `<div class="spm-crumb">
      <button class="btn-nav" onclick="window.__spmGoHome()">⬅ Kembali</button>
      <button class="btn-nav" onclick="window.__spmGoHome()">🏠 Utama</button>
      <span class="sep" style="margin-left: 10px;">/</span>
      <span style="font-weight: 600; color: var(--primary);">${esc(view.category)}</span>
    </div>`;
  }

  function screenHome() {
    return `<div class="spm-main">
      <div class="hero-about"><h2>SEKTOR PERANCANGAN</h2><p>Pusat repositori fail berpusat untuk pengurusan data, pelan strategik, dan infrastruktur pendidikan PPD Muar.</p></div>
      <div class="cards-grid">
        ${CATEGORIES.map(c => `<div class="branch-card" onclick="window.__spmGoCategory('${esc(c)}')"><h3>${esc(c)}</h3></div>`).join("")}
      </div></div>`;
  }

  function screenDashboard() {
    const filtered = resources.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const cards = filtered.map(r => {
      const thumb = getDriveThumbnailUrl(r.link), safeId = typeof r.id === 'string' ? `'${r.id}'` : r.id;
      return `<div class="activity-card"><div class="activity-image">${thumb ? `<img src="${esc(thumb)}">` : `G-DRIVE`}</div>
        <div class="activity-body"><h3><a href="${esc(r.link)}" target="_blank">${esc(r.title)}</a></h3>
        <div class="activity-meta">${r.year ? `Tahun: ${esc(r.year)}<br>` : ""}Oleh: ${esc(r.uploaded_by)}</div>
        <div class="activity-actions"><button onclick="window.__spmEdit(${safeId})">Edit</button><button class="btn-del" onclick="window.requestDeleteResource(${safeId})">Padam</button></div></div></div>`;
    }).join("");

    return `<div class="spm-main"><div class="toolbar"><div class="toolbar-title"><h2>${esc(view.category)}</h2></div>
      <div><input class="search-input" placeholder="Cari..." value="${esc(searchQuery)}" oninput="window.__spmOnSearch(this.value)">
      <button class="btn-add" onclick="window.__spmOpenModal()">+ Tambah</button></div></div>
      <div class="activity-gallery">${cards || `<div class="activity-empty">Tiada rekod dijumpai.</div>`}</div></div>
      ${view.showModal ? modal() : ""}`;
  }

  function modal() {
    const r = editingResource;
    return `<div class="modal-overlay" onclick="if(event.target===this) window.__spmCloseModal()"><div class="modal-box">
      <h3>${r ? "KEMASKINI" : "TAMBAH"} PAUTAN</h3>
      <div class="modal-field"><label>Tajuk</label><input id="f-title" value="${r ? esc(r.title) : ""}"></div>
      <div class="modal-field"><label>Pautan Drive</label><input id="f-link" value="${r ? esc(r.link) : ""}"></div>
      <div class="modal-field"><label>Tahun</label><input id="f-year" type="number" value="${r?.year || ""}"></div>
      <div class="modal-field"><label>Dimuat Naik Oleh</label><input id="f-author" value="${r?.uploaded_by || ""}"></div>
      <div class="modal-actions"><button onclick="window.__spmCloseModal()">Batal</button><button class="btn-save" onclick="window.__spmSaveModal()">Simpan</button></div>
    </div></div>`;
  }

  function render() {
    root.innerHTML = header() + crumb() + (view.screen === "home" ? screenHome() : screenDashboard()) + 
      `<footer class="home-footer"><strong>SEKTOR PERANCANGAN — PPD MUAR</strong></footer>`;
  }
  render();
})();