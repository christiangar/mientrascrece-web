/* Mientras Crece · página de suscripción
 * Calcula la semana exacta (motor de edad, docs/editorial/motor-edad.md),
 * enseña el texto instantáneo y envía el alta al formulario de Brevo.
 */
(function () {
  "use strict";

  // URL del formulario de Brevo (Formularios → Compartir → «action» del HTML).
  // Mientras esté vacía, la página funciona en modo prueba y no guarda nada.
  // Formulario «Alta web mientrascrece.com» (doble confirmación; lista Suscriptores Mientras Crece).
  var CONFIG = { brevoFormUrl: "https://e6a2ed3b.sibforms.com/serve/MUIFAL2coej_48v8Ji6sWCtt5v7rPbK2XZhf4yhXkBE_RHIjUNX4ykmmprQpDoniLQWq-Thn2ezw7UKq6-nPmN7CCiiXHB44C99sVIb_09ZPv3Mbar9SgO5MhNdvAYvvAE47wpjHmRiUy78H8E0SZxJ7tOJUHHKScpk-No2eR1BRLVDHwfXGKg3feS8Ok8BGbRWCurr-Nsl4LquIBA" };

  var DIA = 86400000;
  var MAX_HIJOS = 3;
  var textos = null;
  var $ = function (id) { return document.getElementById(id); };

  fetch("textos.json").then(function (r) { return r.json(); }).then(function (d) { textos = d; });

  // ---------- Fechas ----------
  function hoy() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function leerFecha(valor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || "")) return null;
    var p = valor.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function dias(a, b) { return Math.round((b - a) / DIA); }
  function iso(d) { return d.toISOString().slice(0, 10); }

  // Primer lunes desde el 1 de septiembre: inicio de curso por defecto (motor de edad, pista Curso).
  function inicioCurso(anio) {
    var d = new Date(anio, 8, 1);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
    return d;
  }
  function pad(n, ancho) { n = String(n); while (n.length < ancho) n = "0" + n; return n; }

  // ---------- Motor de edad ----------
  // Devuelve { id, aviso } o { error }.
  function calcular(tipo, fecha, semanasNacer) {
    var h = hoy();
    if (tipo === "embarazo") {
      var faltan = dias(h, fecha);
      if (faltan < -14) return { error: "Esa fecha ya ha pasado. Si ya ha nacido, elige «Ya ha nacido»." };
      if (faltan > 280) return { error: "Esa fecha está muy lejos. Revisa la fecha prevista de parto." };
      var semana = Math.floor((280 - faltan) / 7);
      if (semana < 4) return { id: "G-004", aviso: "Todavía es muy pronto: empezamos a escribirte en la semana 4. Esto es lo que te contaremos entonces." };
      if (semana > 41) semana = 41;
      return { id: "G-" + pad(semana, 3) };
    }

    var vida = dias(fecha, h);
    if (vida < 0) return { error: "Esa fecha aún no ha llegado. Si estáis esperando, elige «Estamos esperando»." };
    if (vida > 7 * 365) return { error: "Por ahora escribimos del embarazo a los 6 años." };

    // Pista Curso: desde septiembre del año en que cumple 3 (año natural, edad cronológica).
    var anio = fecha.getFullYear();
    var i3 = inicioCurso(anio + 3), i4 = inicioCurso(anio + 4), i5 = inicioCurso(anio + 5), fin = inicioCurso(anio + 6);
    if (h >= fin) return { error: "Por ahora escribimos hasta el final de Infantil (5-6 años). Para los mayores estamos preparando una edición por temas." };
    var curso = null, inicio = null;
    if (h >= i5) { curso = "I5"; inicio = i5; } else if (h >= i4) { curso = "I4"; inicio = i4; } else if (h >= i3) { curso = "I3"; inicio = i3; }
    if (curso) {
      var sc = Math.min(52, Math.floor(dias(inicio, h) / 7) + 1);
      return { id: curso + "-" + pad(sc, 3) };
    }

    // Pista Edad, con edad corregida hasta los 24 meses corregidos.
    var edad = vida, aviso = null;
    if (semanasNacer && semanasNacer < 37) {
      var corregida = vida - (40 - semanasNacer) * 7;
      if (corregida < 104 * 7) {
        edad = corregida;
        aviso = "Te escribimos según su edad corregida, como recomiendan los pediatras hasta los 2 años.";
        if (edad < 0) { edad = 0; aviso = "Hasta su fecha prevista de parto le escribimos como a un recién nacido."; }
      }
    }
    var sv = Math.min(191, Math.floor(edad / 7));
    return { id: "E-" + pad(sv, 3), aviso: aviso };
  }

  function conNombre(texto, nombre) {
    var n = nombre || "tu bebé";
    return texto.replace(/(^|[.!?¿¡:]\s+)\{nombre\}/g, function (m, p) { return p + capital(n); })
                .replace(/\{nombre\}/g, n);
  }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- Paso 1 ----------
  var paso1 = $("paso1");
  function tipoActual() { return paso1.querySelector('input[name="tipo"]:checked').value; }

  function ajustarTipo() {
    var emb = tipoActual() === "embarazo";
    $("etiqueta-fecha").textContent = emb ? "Fecha prevista de parto" : "Su fecha de nacimiento";
    $("ayuda-fecha").textContent = emb ? "La que te dieron en la ecografía. Si cambia, la podrás corregir." : "Con su fecha sabemos su edad exacta cada semana.";
    $("bloque-prematuro").hidden = emb;
    $("nombre").placeholder = emb ? "Si ya lo sabéis (opcional)" : "Por ejemplo, Lucía";
  }
  Array.prototype.forEach.call(paso1.querySelectorAll('input[name="tipo"]'), function (r) { r.addEventListener("change", ajustarTipo); });
  $("prematuro").addEventListener("change", function () { $("campo-semanas").hidden = !this.checked; });

  var hijo1 = null;

  paso1.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("error1"); err.hidden = true;
    var tipo = tipoActual();
    var nombre = $("nombre").value.trim();
    var fecha = leerFecha($("fecha").value);
    var semanas = $("prematuro").checked ? parseInt($("semanas").value, 10) : null;

    if (tipo === "nacido" && !nombre) return mostrarError(err, "Escribe su nombre: va en cada email.");
    if (!fecha) return mostrarError(err, tipo === "embarazo" ? "Pon la fecha prevista de parto." : "Pon su fecha de nacimiento.");
    if ($("prematuro").checked && !(semanas >= 22 && semanas <= 36)) return mostrarError(err, "Indica la semana en que nació (entre 22 y 36).");
    if (!textos) return mostrarError(err, "Un segundo, estamos cargando… Vuelve a pulsar.");

    var r = calcular(tipo, fecha, semanas);
    if (r.error) return mostrarError(err, r.error);
    var t = textos[r.id];
    if (!t) return mostrarError(err, "No hemos encontrado su semana. Revisa la fecha.");

    hijo1 = { tipo: tipo, nombre: nombre, fecha: iso(fecha), semanas: semanas || "" };

    $("r-edad").textContent = (nombre ? nombre + " · " : "") + t.edad;
    $("r-titular").textContent = conNombre(t.titular, nombre);
    $("r-texto").textContent = conNombre(t.texto, nombre);
    $("r-cierre").textContent = conNombre(t.cierre, nombre);
    var aviso = r.aviso || (t.listo ? null :
      "Ya tenemos escrito el embarazo y el primer año. Los emails de esta edad están en camino: apúntate y te avisamos en cuanto empiecen.");
    $("r-aviso").hidden = !aviso; $("r-aviso").textContent = aviso || "";

    $("bloque-salud").hidden = !(tipo === "embarazo" || semanas);
    $("resultado").hidden = false;
    $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function mostrarError(el, msg) { el.textContent = msg; el.hidden = false; }

  // ---------- Más hijos ----------
  var extra = $("hijos-extra");
  $("anadir-hijo").addEventListener("click", function () {
    var n = extra.children.length + 2;
    if (n > MAX_HIJOS) return;
    var div = document.createElement("div");
    div.className = "hijo-extra";
    div.innerHTML =
      '<div class="cabeza"><span>Hijo o hija ' + n + '</span><button type="button" class="enlace quitar">Quitar</button></div>' +
      '<div class="campo"><label>¿En qué momento?</label><select class="x-tipo"><option value="nacido">Ya ha nacido</option><option value="embarazo">Estamos esperando</option></select></div>' +
      '<div class="campo"><label>Su nombre</label><input type="text" class="x-nombre" maxlength="40"></div>' +
      '<div class="campo"><label class="x-etq">Su fecha de nacimiento</label><input type="date" class="x-fecha"></div>' +
      '<div class="campo x-prem"><label>Si nació antes de la semana 37, ¿en qué semana? <span class="opcional">(opcional)</span></label><input type="number" min="22" max="36" class="x-semanas" inputmode="numeric"></div>';
    div.querySelector(".quitar").addEventListener("click", function () { div.remove(); renumerar(); });
    div.querySelector(".x-tipo").addEventListener("change", function () {
      var emb = this.value === "embarazo";
      div.querySelector(".x-etq").textContent = emb ? "Fecha prevista de parto" : "Su fecha de nacimiento";
      div.querySelector(".x-prem").hidden = emb;
      actualizarSalud();
    });
    div.querySelector(".x-semanas").addEventListener("input", actualizarSalud);
    extra.appendChild(div);
    renumerar();
  });
  function renumerar() {
    Array.prototype.forEach.call(extra.children, function (d, i) { d.querySelector(".cabeza span").textContent = "Hijo o hija " + (i + 2); });
    $("anadir-hijo").hidden = extra.children.length + 1 >= MAX_HIJOS;
  }
  function hijosExtra() {
    return Array.prototype.map.call(extra.children, function (d) {
      return {
        tipo: d.querySelector(".x-tipo").value,
        nombre: d.querySelector(".x-nombre").value.trim(),
        fecha: d.querySelector(".x-fecha").value,
        semanas: d.querySelector(".x-tipo").value === "nacido" ? (d.querySelector(".x-semanas").value || "") : ""
      };
    });
  }
  function hayDatoSalud(lista) { return lista.some(function (h) { return h.tipo === "embarazo" || h.semanas; }); }
  function actualizarSalud() { $("bloque-salud").hidden = !hayDatoSalud([hijo1 || {}].concat(hijosExtra())); }

  // ---------- País ----------
  $("pais").addEventListener("change", function () { $("campo-comunidad").hidden = this.value !== "ES"; });

  // ---------- Origen (UTM o ruta corta) ----------
  (function () {
    var q = new URLSearchParams(location.search);
    var partes = ["utm_source", "utm_medium", "utm_campaign", "utm_content"].map(function (k) { return q.get(k); }).filter(Boolean);
    if (q.get("ruta")) partes.unshift("ruta:" + q.get("ruta"));
    $("h-origen").value = (partes.join("|") || document.referrer || "directo").slice(0, 200);
  })();

  // ---------- Paso 2 ----------
  $("paso2").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("error2"); err.hidden = true;
    var email = $("email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarError(err, "Revisa tu email.");
    var hijos = [hijo1].concat(hijosExtra());
    for (var i = 1; i < hijos.length; i++) {
      var h = hijos[i];
      if (!leerFecha(h.fecha)) return mostrarError(err, "Falta la fecha del hijo o hija " + (i + 1) + ".");
      if (h.tipo === "nacido" && !h.nombre) return mostrarError(err, "Falta el nombre del hijo o hija " + (i + 1) + ".");
      var c = calcular(h.tipo, leerFecha(h.fecha), parseInt(h.semanas, 10) || null);
      if (c.error) return mostrarError(err, "Hijo o hija " + (i + 1) + ": " + c.error);
    }
    if (!$("acepto").checked) return mostrarError(err, "Marca la casilla para aceptar la política de privacidad.");
    if (hayDatoSalud(hijos) && !$("acepto-salud").checked) return mostrarError(err, "Para escribirte por semanas de embarazo o con edad corregida necesitamos tu consentimiento expreso.");

    // Brevo guarda todo en un solo atributo de texto, DATOS (JSON compacto), que lee el motor de envío.
    // n = nombre, t = tipo (nacido | embarazo), f = fecha (nacimiento o FPP), s = semana de nacimiento si fue prematuro.
    var datos = {
      v: 1,
      pais: $("pais").value,
      com: $("pais").value === "ES" ? $("comunidad").value : "",
      hijos: hijos.map(function (h) { return { n: h.nombre, t: h.tipo, f: h.fecha, s: h.semanas ? Number(h.semanas) : 0 }; }),
      salud: $("acepto-salud").checked,
      alta: new Date().toISOString(),
      origen: $("h-origen").value
    };
    var fd = new FormData();
    fd.set("EMAIL", email);
    fd.set("DATOS", JSON.stringify(datos));
    fd.set("email_address_check", "");
    fd.set("locale", "es");
    fd.set("html_type", "simple");

    var boton = $("paso2").querySelector(".boton");
    boton.disabled = true; boton.textContent = "Enviando…";

    var fin = function (prueba) {
      $("resultado").hidden = true;
      $("modo-prueba").hidden = !prueba;
      $("gracias").hidden = false;
      $("gracias").scrollIntoView({ behavior: "smooth", block: "start" });
    };

    var trampa = $("paso2").querySelector(".trampa");
    if (trampa && trampa.value) return fin(false); // un robot ha rellenado el campo oculto: no se envía nada

    if (!CONFIG.brevoFormUrl) {
      if (window.console) console.info("Modo prueba. Datos que se enviarían:", Object.fromEntries(fd.entries()));
      return fin(true);
    }
    fetch(CONFIG.brevoFormUrl, { method: "POST", body: fd, mode: "no-cors" })
      .then(function () { fin(false); })
      .catch(function () {
        boton.disabled = false; boton.textContent = "Apuntarme gratis";
        mostrarError(err, "No se ha podido enviar. Revisa tu conexión y vuelve a intentarlo.");
      });
  });

  ajustarTipo();
})();
