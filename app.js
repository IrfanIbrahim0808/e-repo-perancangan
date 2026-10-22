
(function () {
  // e-Repo Perancangan — PPD Muar
  // Versi ujian tanpa paparan log masuk.
  // Akses database masih tertakluk kepada polisi Supabase RLS.

const supabaseUrl = "https://pqukdhyuxhitusvbevnc.supabase.co";
const supabaseKey = "sb_publishable_ZfthgGwzgijXsj-1iEL9kg__e-thY1R";

const sb = window.supabase.createClient(
  supabaseUrl,
  supabaseKey
);

  const CATEGORIES = [
    "Data & Unjuran Sekolah",
    "Pelan Strategik & Pemantauan",
    "Infrastruktur & Pembangunan"
  ];

  const root = document.getElementById("spm-app");

  let view = {
  screen: "home",
  category: null,
  folderId: null
  };
  let resources = [];
  let searchQuery = "";
  let editingResource = null;
  let pendingDeleteId = null;
  let loading = false;
  let loadToken = 0;
  let saving = false;
  let deleting = false;

  // ---------- Helpers ----------

  const esc = s =>
    String(s ?? "").replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m]));

  // Hanya benarkan URL http dan https.
  const safeUrl = u => {
    try {
      const x = new URL(String(u).trim());
      return /^https?:$/.test(x.protocol) ? x.href : null;
    } catch {
      return null;
    }
  };

  function getDriveThumbnailUrl(driveUrl) {
    if (!safeUrl(driveUrl)) return null;

    const match =
      driveUrl.match(/[?&]id=([^&]+)/) ||
      driveUrl.match(
        /\/(?:file|document|spreadsheets|presentation)\/d\/([^/?#]+)/
      );

    return match && match[1]
      ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w600`
      : null;
  }

  // ---------- System messages ----------

  window.showSiscAlert = msg => {
    const text = document.getElementById("siscAlertText");
    const box = document.getElementById("siscSystemAlert");

    if (text) text.innerText = msg;
    if (box) box.classList.add("show");
  };

  window.closeSiscAlert = () => {
    const box = document.getElementById("siscSystemAlert");
    if (box) box.classList.remove("show");
  };

  const requestDelete = id => {
    pendingDeleteId = id;
    document.getElementById("siscConfirmModal").classList.add("show");
  };

  window.closeConfirmModal = () => {
    pendingDeleteId = null;
    document.getElementById("siscConfirmModal").classList.remove("show");
  };

  // ---------- Delete resource ----------

  window.executeDelete = async () => {
    if (pendingDeleteId === null || deleting) return;

    const id = pendingDeleteId;
    deleting = true;
    window.closeConfirmModal();

    try {
      const { data, error } = await sb
        .from("resources")
        .delete()
        .eq("id", id)
        .select();

      if (error) {
        showSiscAlert("Gagal memadam: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        showSiscAlert(
          "Tiada rekod dipadam. Semak polisi kebenaran Supabase (RLS) atau pastikan rekod masih wujud."
        );
        return;
      }

      await loadResources(view.category);
      render();
    } catch (error) {
      showSiscAlert(
        "Ralat semasa memadam: " +
        (error.message || "Sila cuba lagi.")
      );
    } finally {
      deleting = false;
    }
  };

  // ---------- Database ----------

  async function loadResources(category) {
    if (!category) return;

    const token = ++loadToken;
    loading = true;
    render();

    try {
      const { data, error } = await sb
        .from("resources")
        .select("*")
        .eq("category", category)
        .order("created_at", { ascending: false });

      if (token !== loadToken) return;

      if (error) {
        resources = [];
        showSiscAlert("Ralat pangkalan data: " + error.message);
        return;
      }

      resources = data || [];
    } catch (error) {
      if (token === loadToken) {
        resources = [];
        showSiscAlert(
          "Tidak dapat memuatkan rekod: " +
          (error.message || "Semak sambungan internet anda.")
        );
      }
    } finally {
      if (token === loadToken) {
        loading = false;
      }
    }
  }

  
async function saveResource(fields) {
  const payload = {
    category: view.category,
    title: fields.title,
    link: fields.link || "",
    year: fields.year ? Number(fields.year) : null,
    uploaded_by: fields.author || "Staf Perancangan",
    item_type: fields.item_type || editingResource?.item_type || "document",
    parent_id: editingResource
      ? editingResource.parent_id
      : (view.folderId ?? null)
  };

  try {
    let query;

    if (editingResource) {
      query = sb
        .from("resources")
        .update(payload)
        .eq("id", editingResource.id);
    } else {
      query = sb
        .from("resources")
        .insert(payload);
    }

    const { data, error } = await query.select();

    if (error) {
      showSiscAlert(
        (editingResource
          ? "Gagal mengemaskini: "
          : "Gagal menambah: ") + error.message
      );
      return false;
    }

    if (!data || data.length === 0) {
      showSiscAlert(
        "Tiada rekod disimpan. Semak polisi kebenaran Supabase (RLS)."
      );
      return false;
    }

    return true;
  } catch (error) {
    showSiscAlert(
      "Ralat semasa menyimpan: " +
      (error.message || "Sila cuba lagi.")
    );
    return false;
  }
}

  // ---------- Navigation ----------

  async function openFolder(folder) {
    view = {
      ...view,
      screen: "dashboard",
      folderId: folder.id
    };
  
    searchQuery = "";
    resources = [];
    loading = true;
    render();
  
    await loadResources(view.category);
  
    if (String(view.folderId) === String(folder.id)) {
      render();
    }
  }

  
  async function goCategory(cat) {
    view = {
  screen: "dashboard",
  category: cat,
  folderId: null
};

    searchQuery = "";
    resources = [];
    loading = true;
    render();

    await loadResources(cat);

    if (view.category === cat) render();
  }

  // ---------- Add / Edit ----------

  async function onSave(btn) {
    if (saving) return;
  
    const titleInput = document.getElementById("f-title");
    const title = titleInput ? titleInput.value.trim() : "";
  
    if (!title) {
      showSiscAlert("Please enter a title or folder name.");
      return;
    }
  
    const isFolder = !editingResource && view.formType === "folder";
  
    let fields;
  
    if (isFolder) {
      fields = {
        title: title,
        link: "",
        year: "",
        author: "Staf Perancangan",
        item_type: "folder"
      };
    } else {
      const linkInput = document.getElementById("f-link");
      const yearInput = document.getElementById("f-year");
      const authorInput = document.getElementById("f-author");
  
      const link = linkInput ? linkInput.value.trim() : "";
      const year = yearInput ? yearInput.value.trim() : "";
      const author = authorInput ? authorInput.value.trim() : "";
  
      if (!link) {
        showSiscAlert("Please enter the Google Drive link.");
        return;
      }
  
      const url = safeUrl(link);
  
      if (!url) {
        showSiscAlert(
          "The link must start with https:// or http://"
        );
        return;
      }
  
      if (year && !Number.isInteger(Number(year))) {
        showSiscAlert("Please enter a valid year.");
        return;
      }
  
      fields = {
        title: title,
        link: url,
        year: year,
        author: author,
        item_type: "document"
      };
    }
  
    saving = true;
    btn.disabled = true;
    btn.textContent = "Saving...";
  
    try {
      const ok = await saveResource(fields);
  
      if (!ok) return;
  
      view.showModal = false;
      view.formType = null;
      editingResource = null;
  
      await loadResources(view.category);
      render();
    } finally {
      saving = false;
  
      const saveButton = document.querySelector(
        '[data-action="save"]'
      );
  
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Simpan";
      }
    }
  }
  
  // ---------- Event delegation ----------

  root.addEventListener("click", e => {
    const el = e.target.closest("[data-action]");
    if (!el) return;

    const action = el.dataset.action;

    if (action === "overlay") {
      if (e.target === el) {
        view.showModal = false;
        render();
      }
      return;
    }

    if (action === "home") {
      loadToken++;
      loading = false;
      view = { screen: "home" };
      searchQuery = "";
      render();
    }
    else if (action === "cat") {
      goCategory(CATEGORIES[Number(el.dataset.i)]);
    } 
    else if (action === "folder") {
      const folder = resources.find(
        r => String(r.id) === el.dataset.id
      );

      if (folder && folder.item_type === "folder") {
        openFolder(folder);
      }

    } else if (action === "add") {
      editingResource = null;
      view.showModal = true;
      view.formType = "choose";
      render();
    } else if (action === "add-folder") {
      editingResource = null;
      view.showModal = true;
      view.formType = "folder";
      render();
    } else if (action === "add-document") {
      editingResource = null;
      view.showModal = true;
      view.formType = "document";
      render();
    } else if (action === "edit") {
      editingResource =
        resources.find(r => String(r.id) === el.dataset.id) || null;

      if (!editingResource) {
        showSiscAlert("Rekod tidak dijumpai. Sila muat semula halaman.");
        return;
      }

      view.showModal = true;
      render();
    } else if (action === "del") {
      requestDelete(el.dataset.id);
    } else if (action === "close-modal") {
      view.showModal = false;
      editingResource = null;
      render();
    } else if (action === "save") {
      onSave(el);
    }
  });

  // ---------- Search ----------

  root.addEventListener("input", e => {
    if (e.target.id !== "search") return;

    searchQuery = e.target.value;

    const gallery = document.getElementById("gallery");
    if (gallery) gallery.innerHTML = galleryHtml();
  });

  // Thumbnail rosak: paparkan teks G-DRIVE.
  root.addEventListener("error", e => {
    if (
      e.target.tagName === "IMG" &&
      e.target.dataset.thumb
    ) {
      e.target.parentNode.textContent = "G-DRIVE";
    }
  }, true);

  // ---------- UI ----------

  function header() {
    return `<header class="header">
      <div class="carousel-slide" style="background-image: url('bg-1.jpg'); animation-delay: 0s;"></div>
      <div class="carousel-slide" style="background-image: url('bg-2.jpg'); animation-delay: 5s;"></div>
      <div class="carousel-slide" style="background-image: url('bg-3.jpg'); animation-delay: 10s;"></div>
      <div class="carousel-overlay"></div>
      <div class="header-content">
        <img src="logo-ppd.png" alt="Logo Rasmi PPD Muar" class="header-logo">
        <h1>SEKTOR PERANCANGAN</h1>
        <p>Pejabat Pendidikan Daerah Muar</p>
      </div>
    </header>`;
  }

  // Tiada bar log masuk dalam versi ujian ini.
  function authBar() {
    return "";
  }

  
function crumb() {
  if (view.screen === "home") return "";

  // Find the current folder and its parent folders.
  const folderPath = [];
  let currentFolder = resources.find(
    r => String(r.id) === String(view.folderId)
  );

  while (currentFolder) {
    folderPath.unshift(currentFolder);

    if (currentFolder.parent_id == null) break;

    currentFolder = resources.find(
      r => String(r.id) === String(currentFolder.parent_id)
    );
  }

  const categoryIndex = CATEGORIES.indexOf(view.category);

    return `
      <div class="spm-crumb">
        <div class="crumb-navigation">
          ${
            view.folderId != null
              ? `<button class="btn-nav" data-action="parent">
                   ← Kembali
                 </button>`
              : ""
          }
  
          <button class="btn-nav" data-action="home">
            🏠 Utama
          </button>
  
          <span class="sep">/</span>
  
          <button
            class="crumb-link"
            data-action="cat"
            data-i="${categoryIndex}">
            ${esc(view.category)}
          </button>
  
          ${folderPath.map(folder => `
            <span class="sep">/</span>
            <button
              class="crumb-link"
              data-action="open-crumb"
              data-id="${esc(folder.id)}">
              ${esc(folder.title)}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function screenHome() {
    return `<div class="spm-main">
      <div class="hero-about">
        <h2>SEKTOR PERANCANGAN</h2>
        <p>Pusat repositori fail berpusat untuk pengurusan data, pelan strategik, dan infrastruktur pendidikan PPD Muar.</p>
      </div>
      <div class="cards-grid">
        ${CATEGORIES.map((category, i) => `
          <button
            type="button"
            class="branch-card"
            data-action="cat"
            data-i="${i}">
            <h3>${esc(category)}</h3>
          </button>
        `).join("")}
      </div>
    </div>`;
  }

  
function galleryHtml() {
  if (loading) {
    return `<div class="activity-empty">Memuatkan...</div>`;
  }

  const q = searchQuery.toLowerCase();

  const filtered = resources.filter(r =>
    String(r.title ?? "").toLowerCase().includes(q) &&
    (
      r.parent_id == null
        ? view.folderId == null
        : String(r.parent_id) === String(view.folderId)
    )
  );

  if (!filtered.length) {
    return `<div class="activity-empty">Tiada rekod dijumpai.</div>`;
  }

  return filtered.map(r => {
    const id = esc(r.id);
    const title = esc(r.title);

    // Folder cards open inside e-Repo.
    if (r.item_type === "folder") {
      return `
        <div class="activity-card folder-card">
          <button
            type="button"
            class="folder-open"
            data-action="folder"
            data-id="${id}"
            aria-label="Buka folder ${title}">
            <div class="activity-image">
              <div class="drive-preview">
                <div class="drive-icon" aria-hidden="true">
                  <svg viewBox="0 0 48 48" width="48" height="48">
                    <path fill="#4285F4"
                      d="M4 12a4 4 0 0 1 4-4h12l4 5h16a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/>
                    <path fill="#A1C2FA"
                      d="M4 19h40l-5 17a4 4 0 0 1-4 3H8a4 4 0 0 1-4-4z"/>
                  </svg>
                </div>
                <span class="drive-label">FOLDER</span>
                <span class="drive-subtitle">Click to open</span>
              </div>
            </div>
            <div class="activity-body">
              <h3>${title}</h3>
              <div class="activity-meta">
                ${r.year ? `Tahun: ${esc(r.year)}<br>` : ""}
                Folder
              </div>
            </div>
          </button>

          <div class="activity-actions">
            <button type="button" data-action="edit" data-id="${id}">Edit</button>
            <button type="button" class="btn-del" data-action="del" data-id="${id}">Padam</button>
          </div>
        </div>`;
    }

    // Document cards retain the existing Google Drive link.
    const href = safeUrl(r.link);

    return `
      <div class="activity-card">
        <div class="activity-image">
          <div class="drive-preview">
            <div class="drive-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="48" height="48">
                <path fill="#4285F4" d="M16 6h10L11 33H1z"/>
                <path fill="#34A853" d="M16 6h10l16 27H31z"/>
                <path fill="#FBBC04" d="M1 33h30l-5 9H6z"/>
                <path fill="#188038" d="M31 33h11l-5 9H26z"/>
              </svg>
            </div>
            <span class="drive-label">GOOGLE DRIVE</span>
            <span class="drive-subtitle">Folder &amp; Documents</span>
          </div>
        </div>

        <div class="activity-body">
          <h3>
            ${href
              ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${title}</a>`
              : title}
          </h3>

          <div class="activity-meta">
            ${r.year ? `Tahun: ${esc(r.year)}<br>` : ""}
            Oleh: ${esc(r.uploaded_by || "Staf Perancangan")}
          </div>

          <div class="activity-actions">
            <button type="button" data-action="edit" data-id="${id}">Edit</button>
            <button type="button" class="btn-del" data-action="del" data-id="${id}">Padam</button>
          </div>
        </div>
      </div>`;
  }).join("");
}


  function screenDashboard() {
    return `<div class="spm-main">
      <div class="toolbar">
        <div class="toolbar-title">
          <h2>${esc(view.category)}</h2>
        </div>

        <div>
          <input
            id="search"
            class="search-input"
            placeholder="Cari..."
            value="${esc(searchQuery)}"
            aria-label="Cari tajuk">

             <button type="button" class="btn-add" data-action="add">
           + Tambah
        </button>
        </div>
      </div>

      <div class="activity-gallery" id="gallery">
        ${galleryHtml()}
      </div>
    </div>`;
  }

 
function modal() {
  const r = editingResource;
  const formType = editingResource ? "document" : (view.formType || "choose");

  // Choose what to add
  if (formType === "choose") {
    return `<div class="modal-overlay" data-action="overlay">
      <div class="modal-box">
        <h3>TAMBAH SUMBER</h3>
        <p>Pilih apa yang anda mahu tambah.</p>

        <div class="modal-actions">
          <button type="button" data-action="add-folder">
            📁 Cipta Folder
          </button>
          <button type="button" class="btn-save" data-action="add-document">
            📄 Tambah Dokumen
          </button>
        </div>

        <div class="modal-actions">
          <button type="button" data-action="close-modal">Batal</button>
        </div>
      </div>
    </div>`;
  }

  // Create folder form
  if (formType === "folder") {
    return `<div class="modal-overlay" data-action="overlay">
      <div class="modal-box">
        <h3>CIPTA FOLDER</h3>

        <div class="modal-field">
          <label for="f-title">Nama Folder</label>
          <input id="f-title" placeholder="Contoh: 2026">
        </div>

        <div class="modal-actions">
          <button type="button" data-action="add">Kembali</button>
          <button type="button" class="btn-save" data-action="save">Simpan</button>
        </div>
      </div>
    </div>`;
  }

  // Add or edit document form
  return `<div class="modal-overlay" data-action="overlay">
    <div class="modal-box">
      <h3>${r ? "KEMASKINI" : "TAMBAH"} DOKUMEN</h3>

      <div class="modal-field">
        <label for="f-title">Tajuk</label>
        <input id="f-title" value="${esc(r?.title)}">
      </div>

      <div class="modal-field">
        <label for="f-link">Pautan Drive</label>
        <input
          id="f-link"
          value="${esc(r?.link)}"
          placeholder="https://">
      </div>

      <div class="modal-field">
        <label for="f-year">Tahun</label>
        <input
          id="f-year"
          type="number"
          value="${esc(r?.year)}">
      </div>

      <div class="modal-field">
        <label for="f-author">Dimuat Naik Oleh</label>
        <input
          id="f-author"
          value="${esc(r?.uploaded_by)}">
      </div>

      <div class="modal-actions">
        <button type="button" data-action="close-modal">Batal</button>
        <button type="button" class="btn-save" data-action="save">Simpan</button>
      </div>
    </div>
  </div>`;
}

  // ---------- Initialise website ----------

  root.innerHTML =
    header() +
    `<div id="spm-view"></div>` +
    `<footer class="home-footer">
      <strong>SEKTOR PERANCANGAN — PPD MUAR</strong>
    </footer>`;

  function render() {
    const target = document.getElementById("spm-view");
    if (!target) return;

    target.innerHTML =
      authBar() +
      crumb() +
      (view.screen === "home" ? screenHome() : screenDashboard()) +
      (view.showModal ? modal() : "");
  }

  render();
})();
