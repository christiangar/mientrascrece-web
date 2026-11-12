/* Mientras Crece · página de suscripción
 * Calcula la semana exacta (motor de edad, docs/editorial/motor-edad.md),
 * envía el alta al formulario de Brevo y, después, enseña lo que vive esta semana.
 */
(function () {
  "use strict";

  // URL del formulario de Brevo (Formularios → Compartir → «action» del HTML).
  // Mientras esté vacía, la página funciona en modo prueba y no guarda nada.
  // Formulario «Alta web mientrascrece.com» (doble confirmación; lista Suscriptores Mientras Crece).
  var CONFIG = { brevoFormUrl: "https://e6a2ed3b.sibforms.com/serve/MUIFAL2coej_48v8Ji6sWCtt5v7rPbK2XZhf4yhXkBE_RHIjUNX4ykmmprQpDoniLQWq-Thn2ezw7UKq6-nPmN7CCiiXHB44C99sVIb_09ZPv3Mbar9SgO5MhNdvAYvvAE47wpjHmRiUy78H8E0SZxJ7tOJUHHKScpk-No2eR1BRLVDHwfXGKg3feS8Ok8BGbRWCurr-Nsl4LquIBA==?isAjax=1" };

  var DIA = 86400000;
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
  // Fecha local (toISOString pasaría a UTC y en España restaría un día)
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2); }

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

  function mostrarError(el, msg) { el.textContent = msg; el.hidden = false; }
  var form = $("alta");
  function tipoActual() { return form.querySelector('input[name="tipo"]:checked').value; }

  function ajustarTipo() {
    var emb = tipoActual() === "embarazo";
    $("etiqueta-fecha").textContent = emb ? "Fecha prevista de parto" : "Su fecha de nacimiento";
    $("bloque-salud").hidden = !emb;
  }
  Array.prototype.forEach.call(form.querySelectorAll('input[name="tipo"]'), function (r) { r.addEventListener("change", ajustarTipo); });

  // ---------- Ciudad (D124): de la lista salen provincia, comunidad y país ----------
  var PAISES = { ES: "España", MX: "México", AR: "Argentina", CO: "Colombia", CL: "Chile", PE: "Perú", US: "Estados Unidos", OTRO: "Otro país" };
  var ciudades = null, elegida = null, cargando = false;
  function cargarCiudades() {
    if (ciudades || cargando) return;
    cargando = true;
    fetch("ciudades.json").then(function (r) { return r.json(); }).then(function (d) {
      ciudades = d.map(function (c) { return { c: c, k: normal(c[0]) }; });
      buscar();
    }).catch(function () { cargando = false; });
  }
  function normal(t) { return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function ponerPais(cod) {
    $("pais").value = PAISES[cod] ? cod : "OTRO";
    $("pais-texto").textContent = PAISES[$("pais").value];
  }
  // País por defecto: el del idioma del móvil (es-MX → México); si no, España.
  (function () {
    var m = (navigator.language || "").match(/^es-([A-Z]{2})$/i); // solo si el móvil está en español
    ponerPais(m && PAISES[m[1].toUpperCase()] ? m[1].toUpperCase() : "ES");
  })();
  $("cambiar-pais").addEventListener("click", function () { $("ayuda-pais").hidden = true; $("pais").hidden = false; $("pais").focus(); });
  $("pais").addEventListener("change", function () { $("pais-texto").textContent = PAISES[this.value]; });

  var lista = $("sugerencias"), campoCiudad = $("ciudad");
  function cerrar() { lista.hidden = true; campoCiudad.setAttribute("aria-expanded", "false"); }
  function buscar() {
    var q = normal(campoCiudad.value.trim());
    elegida = null;
    if (q.length < 2 || !ciudades) return cerrar();
    var pais = $("pais").value, empieza = [], contiene = [];
    for (var i = 0; i < ciudades.length && empieza.length < 8; i++) {
      var x = ciudades[i], pos = x.k.indexOf(q);
      if (pos === 0) empieza.push(x.c); else if (pos > 0 && contiene.length < 8) contiene.push(x.c);
    }
    var res = empieza.concat(contiene);
    // primero las del país elegido y las de nombre más corto (las coincidencias exactas suben solas)
    res.sort(function (a, b) { return (a[3] !== pais) - (b[3] !== pais) || a[0].length - b[0].length; });
    res = res.slice(0, 6);
    lista.innerHTML = "";
    res.forEach(function (c, n) {
      var li = document.createElement("li");
      li.setAttribute("role", "option"); li.id = "sug-" + n;
      li.innerHTML = "<strong></strong> <span></span>";
      li.firstChild.textContent = c[0];
      li.lastChild.textContent = (c[1] && c[1] !== c[0] ? c[1] + ", " : "") + PAISES[c[3]];
      li.addEventListener("mousedown", function (e) { e.preventDefault(); elegir(c); });
      lista.appendChild(li);
    });
    lista.hidden = !res.length;
    campoCiudad.setAttribute("aria-expanded", res.length ? "true" : "false");
  }
  function elegir(c) {
    elegida = c;
    campoCiudad.value = c[0] + (c[1] && c[1] !== c[0] ? " (" + c[1] + ")" : "");
    ponerPais(c[3]);
    $("ayuda-pais").hidden = false; $("pais").hidden = true;
    cerrar();
  }
  campoCiudad.addEventListener("focus", cargarCiudades);
  campoCiudad.addEventListener("input", function () { cargarCiudades(); buscar(); });
  campoCiudad.addEventListener("blur", function () { setTimeout(cerrar, 150); });
  campoCiudad.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !lista.hidden && lista.firstChild) { e.preventDefault(); lista.firstChild.dispatchEvent(new MouseEvent("mousedown")); }
    if (e.key === "Escape") cerrar();
  });

  // ---------- Origen (UTM o ruta corta) ----------
  (function () {
    var q = new URLSearchParams(location.search);
    var partes = ["utm_source", "utm_medium", "utm_campaign", "utm_content"].map(function (k) { return q.get(k); }).filter(Boolean);
    if (q.get("ruta")) partes.unshift("ruta:" + q.get("ruta"));
    $("h-origen").value = (partes.join("|") || document.referrer || "directo").slice(0, 200);
  })();

  // ---------- Envío ----------
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("error"); err.hidden = true;
    var tipo = tipoActual();
    var fecha = leerFecha($("fecha").value);
    var email = $("email").value.trim();

    if (!fecha) return mostrarError(err, tipo === "embarazo" ? "Pon la fecha prevista de parto." : "Pon su fecha de nacimiento.");
    if (!textos) return mostrarError(err, "Un segundo, estamos cargando… Vuelve a pulsar.");
    var r = calcular(tipo, fecha, null);
    if (r.error) return mostrarError(err, r.error);
    var t = textos[r.id];
    if (!t) return mostrarError(err, "No hemos encontrado su semana. Revisa la fecha.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarError(err, "Revisa tu email.");
    if (!$("acepto").checked) return mostrarError(err, "Marca la casilla para aceptar la política de privacidad.");
    if (tipo === "embarazo" && !$("acepto-salud").checked) return mostrarError(err, "Para escribirte por semanas de embarazo necesitamos tu consentimiento expreso.");

    // Lo que vive esta semana: se enseña después, como premio (alternativa A).
    $("r-edad").textContent = t.edad;
    $("r-titular").textContent = conNombre(t.titular, "");
    $("r-texto").textContent = conNombre(t.texto, "");
    $("r-cierre").textContent = conNombre(t.cierre, "");
    var aviso = r.aviso || (t.listo ? null :
      "Ya tenemos escrito el embarazo y el primer año. Los emails de esta edad están en camino: te avisamos en cuanto empiecen.");
    $("r-aviso").hidden = !aviso; $("r-aviso").textContent = aviso || "";

    // Brevo guarda todo en un solo atributo de texto, DATOS (JSON compacto), que lee el motor de envío.
    // n = nombre (se pide en el primer email), t = tipo (nacido | embarazo), f = fecha, s = semana de nacimiento si fue prematuro.
    var texto = campoCiudad.value.trim();
    var datos = {
      v: 2,
      pais: $("pais").value,
      ciudad: elegida ? elegida[0] : texto.slice(0, 60),
      prov: elegida ? elegida[1] : "",
      com: elegida && elegida[3] === "ES" ? elegida[2] : "",
      hijos: [{ n: "", t: tipo, f: iso(fecha), s: 0 }],
      salud: tipo === "embarazo" && $("acepto-salud").checked,
      alta: new Date().toISOString(),
      origen: $("h-origen").value
    };
    var fd = new FormData();
    fd.set("EMAIL", email);
    fd.set("DATOS", JSON.stringify(datos));
    fd.set("email_address_check", "");
    fd.set("locale", "es");
    fd.set("html_type", "simple");

    var boton = form.querySelector(".boton");
    boton.disabled = true; boton.textContent = "Enviando…";

    var fin = function (prueba) {
      form.hidden = true;
      $("modo-prueba").hidden = !prueba;
      $("gracias").hidden = false;
      $("gracias").scrollIntoView({ behavior: "smooth", block: "start" });
    };

    var trampa = form.querySelector(".trampa");
    if (trampa && trampa.value) return fin(false); // un robot ha rellenado el campo oculto: no se envía nada

    if (!CONFIG.brevoFormUrl || /[?&]prueba=1/.test(location.search)) {
      if (window.console) console.info("Modo prueba. Datos que se enviarían:", Object.fromEntries(fd.entries()));
      return fin(true);
    }
    var fallo = function (msg) {
      boton.disabled = false; boton.textContent = "Quiero recibirlo";
      mostrarError(err, msg || "No se ha podido enviar. Revisa tu conexión y vuelve a intentarlo.");
      if (window.console) console.warn("Brevo rechazó el alta:", msg);
    };
    // Brevo permite leer su respuesta desde mientrascrece.com (CORS): {"success": true} o {"success": false, "message": "…"}.
    fetch(CONFIG.brevoFormUrl, { method: "POST", body: fd })
      .then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); })
      .then(function (j) {
        if (j && j.success) return fin(false);
        fallo("No hemos podido apuntarte. Revisa tu email y vuelve a intentarlo en unos minutos.");
      })
      .catch(function () { fallo(); });
  });

  ajustarTipo();
})();
