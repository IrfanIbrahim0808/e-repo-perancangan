
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

  let view = { screen: "home" };
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
      link: fields.link,
      year: fields.year ? Number(fields.year) : null,
      uploaded_by: fields.author || "Staf Perancangan"
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

  async function goCategory(cat) {
    view = {
      screen: "dashboard",
      category: cat
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

    const title = document.getElementById("f-title").value.trim();
    const link = document.getElementById("f-link").value.trim();
    const year = document.getElementById("f-year").value.trim();
    const author = document.getElementById("f-author").value.trim();

    if (!title || !link) {
      showSiscAlert("Sila isi tajuk dan pautan.");
      return;
    }

    const url = safeUrl(link);

    if (!url) {
      showSiscAlert("Pautan mesti bermula dengan https:// atau http://");
      return;
    }

    if (year && !Number.isInteger(Number(year))) {
      showSiscAlert("Sila masukkan tahun yang sah.");
      return;
    }

    saving = true;
    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    try {
      const ok = await saveResource({
        title,
        link: url,
        year,
        author
      });

      if (!ok) return;

      view.showModal = false;
      editingResource = null;

      await loadResources(view.category);
      render();
    } finally {
      saving = false;

      // Jika modal masih terbuka, benarkan pengguna cuba semula.
      const saveButton = document.querySelector('[data-action="save"]');

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
    } else if (action === "cat") {
      goCategory(CATEGORIES[Number(el.dataset.i)]);
    } else if (action === "add") {
      editingResource = null;
      view.showModal = true;
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

    return `<div class="spm-crumb">
      <button class="btn-nav" data-action="home">🏠 Utama</button>
      <span class="sep" style="margin-left: 10px;">/</span>
      <span style="font-weight: 600; color: var(--primary);">${esc(view.category)}</span>
    </div>`;
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
      String(r.title ?? "").toLowerCase().includes(q)
    );

    if (!filtered.length) {
      return `<div class="activity-empty">Tiada rekod dijumpai.</div>`;
    }

    return filtered.map(r => {
      const href = safeUrl(r.link);
      const thumb = getDriveThumbnailUrl(r.link);
      const id = esc(r.id);

      return `<div class="activity-card">
        <div class="activity-image">
          ${thumb
            ? `<img
                src="${esc(thumb)}"
                alt="Pratonton ${esc(r.title)}"
                loading="lazy"
                data-thumb="1">`
            : "G-DRIVE"}
        </div>

        <div class="activity-body">
          <h3>
            ${href
              ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>`
              : esc(r.title)}
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

    return `<div class="modal-overlay" data-action="overlay">
      <div class="modal-box">
        <h3>${r ? "KEMASKINI" : "TAMBAH"} PAUTAN</h3>

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
