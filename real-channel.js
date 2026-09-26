(function () {
  "use strict";

  const state = {
    client: null,
    session: null,
    membership: null,
    conversation: null,
    subscription: null
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char];
    });
  }

  function sheet() {
    return document.getElementById("ed-real-sheet");
  }

  function setContent(html) {
    const el = sheet();
    if (el) el.innerHTML = html;
  }

  function errorMessage(error) {
    const message = error && error.message ? error.message : "No fue posible completar la acción.";
    return escapeHtml(message);
  }

  function initClient() {
    if (state.client) return state.client;
    if (!window.supabase || !window.ED_CONFIG) {
      throw new Error("La conexión de desarrollo no terminó de cargar.");
    }
    state.client = window.supabase.createClient(
      window.ED_CONFIG.supabaseUrl,
      window.ED_CONFIG.supabaseKey,
      {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        realtime: { params: { eventsPerSecond: 10 } }
      }
    );
    return state.client;
  }

  function ensureOverlay() {
    if (document.getElementById("ed-real-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "ed-real-overlay";
    overlay.className = "modal hide";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Canal real de desarrollo");
    overlay.innerHTML = '<div class="sheet" id="ed-real-sheet"></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
  }

  function loginView(message) {
    setContent(
      '<p class="k" style="color:#4A5568">ENTORNO DE DESARROLLO</p>' +
      '<h2 style="margin:6px 0 8px">Canal real</h2>' +
      '<p class="muted">Acceso para cuentas de prueba autorizadas. Aquí los mensajes salen de este teléfono y se guardan en el servidor.</p>' +
      (message ? '<p class="note" style="color:#A33B3B">' + escapeHtml(message) + '</p>' : '') +
      '<form id="ed-real-login">' +
      '<label class="note" for="ed-real-email">Correo de prueba</label>' +
      '<input id="ed-real-email" type="email" autocomplete="username" required />' +
      '<label class="note" for="ed-real-password">Contraseña</label>' +
      '<input id="ed-real-password" type="password" autocomplete="current-password" required />' +
      '<button class="btn blue" type="submit">Entrar de forma segura</button>' +
      '</form>' +
      '<button class="btn line" type="button" id="ed-real-close">Volver</button>'
    );
    document.getElementById("ed-real-login").addEventListener("submit", login);
    document.getElementById("ed-real-close").addEventListener("click", close);
  }

  async function login(event) {
    event.preventDefault();
    const email = document.getElementById("ed-real-email").value.trim();
    const password = document.getElementById("ed-real-password").value;
    setContent('<div class="card"><h2>Entrando…</h2><p class="muted">Validando cuenta y escuela.</p></div>');
    try {
      const client = initClient();
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      state.session = result.data.session;
      await loadWorkspace();
    } catch (error) {
      loginView(errorMessage(error));
    }
  }

  async function loadWorkspace() {
    const client = initClient();
    const sessionResult = await client.auth.getSession();
    state.session = sessionResult.data.session;
    if (!state.session) {
      loginView();
      return;
    }

    const membershipResult = await client
      .from("school_memberships")
      .select("id, school_id, role, schools(name)")
      .eq("user_id", state.session.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (membershipResult.error) throw membershipResult.error;
    state.membership = membershipResult.data;
    if (!state.membership) {
      setContent(
        '<div class="card"><h2>Cuenta sin escuela</h2><p class="muted">La cuenta es válida, pero todavía no tiene una escuela de prueba asignada.</p></div>' +
        '<button class="btn line" id="ed-real-logout">Cerrar sesión</button>'
      );
      document.getElementById("ed-real-logout").addEventListener("click", logout);
      return;
    }

    const conversationsResult = await client
      .from("conversations")
      .select("id, school_id, kind, title, created_at")
      .eq("school_id", state.membership.school_id)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(1);
    if (conversationsResult.error) throw conversationsResult.error;
    state.conversation = conversationsResult.data[0] || null;
    renderWorkspace();
    if (state.conversation) await loadMessages();
  }

  function renderWorkspace() {
    const school = state.membership.schools && state.membership.schools.name
      ? state.membership.schools.name
      : "Escuela de prueba";
    setContent(
      '<div class="row"><div><p class="k" style="color:#4A5568">CANAL REAL</p><h2 style="margin:4px 0">' + escapeHtml(school) + '</h2></div>' +
      '<span class="pill ok">' + escapeHtml(state.membership.role) + '</span></div>' +
      '<p class="note">Los mensajes de esta pantalla usan el servidor de desarrollo, no localStorage.</p>' +
      (state.conversation
        ? '<div id="ed-real-messages" aria-live="polite"><div class="card"><p class="muted">Cargando mensajes…</p></div></div>' +
          '<form id="ed-real-compose"><textarea id="ed-real-body" maxlength="10000" rows="3" placeholder="Escribe un aviso o mensaje" required></textarea>' +
          '<button class="btn blue" type="submit">Enviar al servidor</button></form>'
        : '<div class="card"><h2>Sin canal asignado</h2><p class="muted">La escuela existe, pero esta cuenta aún no pertenece a una conversación de prueba.</p></div>') +
      '<button class="btn line" id="ed-real-refresh">Actualizar</button>' +
      '<button class="btn line" id="ed-real-logout">Cerrar sesión</button>' +
      '<button class="btn line" id="ed-real-close">Volver al demo</button>'
    );
    if (state.conversation) {
      document.getElementById("ed-real-compose").addEventListener("submit", sendMessage);
    }
    document.getElementById("ed-real-refresh").addEventListener("click", loadWorkspace);
    document.getElementById("ed-real-logout").addEventListener("click", logout);
    document.getElementById("ed-real-close").addEventListener("click", close);
  }

  async function loadMessages() {
    const client = initClient();
    const result = await client
      .from("messages")
      .select("id, sender_user_id, body, created_at, message_reads(user_id, read_at)")
      .eq("conversation_id", state.conversation.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100);
    if (result.error) throw result.error;
    renderMessages(result.data || []);
    await markUnread(result.data || []);
    subscribe();
  }

  function renderMessages(messages) {
    const host = document.getElementById("ed-real-messages");
    if (!host) return;
    if (!messages.length) {
      host.innerHTML = '<div class="card"><h2>Sin mensajes</h2><p class="muted">Envía el primero desde este dispositivo.</p></div>';
      return;
    }
    host.innerHTML = messages.map(function (message) {
      const mine = message.sender_user_id === state.session.user.id;
      const reads = Array.isArray(message.message_reads) ? message.message_reads.length : 0;
      return '<div class="card"><div class="row"><b>' + (mine ? "Tú" : "Otro usuario") + '</b>' +
        '<span class="pill ' + (reads ? "ok" : "") + '">' + (reads ? "Abierto" : "Enviado") + '</span></div>' +
        '<p class="muted" style="white-space:pre-wrap">' + escapeHtml(message.body) + '</p>' +
        '<p class="note">' + escapeHtml(new Date(message.created_at).toLocaleString("es-MX")) + '</p></div>';
    }).join("");
    host.scrollTop = host.scrollHeight;
  }

  async function markUnread(messages) {
    const mine = state.session.user.id;
    const unread = messages.filter(function (message) {
      return message.sender_user_id !== mine &&
        !(message.message_reads || []).some(function (read) { return read.user_id === mine; });
    });
    if (!unread.length) return;
    const rows = unread.map(function (message) { return { message_id: message.id, user_id: mine }; });
    const result = await initClient().from("message_reads").upsert(rows, { onConflict: "message_id,user_id" });
    if (result.error) throw result.error;
  }

  async function sendMessage(event) {
    event.preventDefault();
    const input = document.getElementById("ed-real-body");
    const body = input.value.trim();
    if (!body) return;
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const result = await initClient().from("messages").insert({
        conversation_id: state.conversation.id,
        school_id: state.membership.school_id,
        sender_user_id: state.session.user.id,
        body,
        client_message_id: crypto.randomUUID()
      });
      if (result.error) throw result.error;
      input.value = "";
      await loadMessages();
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      button.disabled = false;
    }
  }

  function subscribe() {
    if (state.subscription) initClient().removeChannel(state.subscription);
    state.subscription = initClient()
      .channel("ed-messages-" + state.conversation.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: "conversation_id=eq." + state.conversation.id },
        loadMessages
      )
      .subscribe();
  }

  async function logout() {
    if (state.subscription) await initClient().removeChannel(state.subscription);
    state.subscription = null;
    await initClient().auth.signOut();
    state.session = null;
    state.membership = null;
    state.conversation = null;
    loginView();
  }

  function close() {
    const overlay = document.getElementById("ed-real-overlay");
    if (overlay) overlay.classList.add("hide");
  }

  async function open() {
    ensureOverlay();
    document.getElementById("ed-real-overlay").classList.remove("hide");
    setContent('<div class="card"><h2>Conectando…</h2><p class="muted">Preparando el entorno de desarrollo.</p></div>');
    try {
      initClient();
      await loadWorkspace();
    } catch (error) {
      loginView(errorMessage(error));
    }
  }

  window.EDReal = Object.freeze({ open, close });
})();
