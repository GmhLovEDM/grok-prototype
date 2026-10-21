(function () {
  "use strict";

  var SESSION_KEY = "shiguang.session";
  var REMEMBER_KEY = "shiguang.remember";
  var FLASH_KEY = "shiguang.flash";

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function normalize(value) {
    return String(value || "").trim().replace(/\s+/g, "");
  }

  function isPhone(value) {
    return /^1[3-9]\d{9}$/.test(value);
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function readSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.account !== "string" || !data.account) return null;
      return data;
    } catch (err) {
      return null;
    }
  }

  function writeSession(account) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ account: normalize(account), loggedInAt: Date.now() })
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function maskAccount(account) {
    if (isPhone(account)) return account.slice(0, 3) + "****" + account.slice(7);
    var at = account.indexOf("@");
    if (at > 0) return account.slice(0, 1) + "***" + account.slice(at);
    return account;
  }

  function setError(input, message) {
    var field = input.closest(".field");
    if (!field) return;
    var error = $(".error", field);
    if (!error) return;
    if (message) {
      input.setAttribute("aria-invalid", "true");
      error.hidden = false;
      error.textContent = message;
      field.classList.add("is-invalid");
    } else {
      input.removeAttribute("aria-invalid");
      error.hidden = true;
      error.textContent = "";
      field.classList.remove("is-invalid");
    }
  }

  function bindLiveClear(input) {
    var eventName = input.type === "checkbox" ? "change" : "input";
    input.addEventListener(eventName, function () {
      if (input.getAttribute("aria-invalid") === "true") setError(input, "");
    });
  }

  function focusFirstInvalid(form) {
    var el = form.querySelector("[aria-invalid='true']");
    if (el) el.focus();
  }

  function showToast(message) {
    var host = $(".app") || document.body;
    var toast = $(".toast", host);
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      host.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 2600);
  }

  function setLoading(button, text) {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + text + "</span>";
  }

  function validatePassword(value, emptyText) {
    if (!value) return emptyText;
    if (value.length < 8 || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
      return "密码至少 8 位，且需包含字母和数字";
    }
    return "";
  }

  function bindSecretToggles(scope) {
    scope.querySelectorAll("[data-toggle-secret]").forEach(function (button) {
      var input = document.getElementById(button.getAttribute("data-toggle-secret"));
      if (!input) return;
      button.addEventListener("click", function () {
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-pressed", show ? "true" : "false");
        button.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
        button.textContent = show ? "隐藏" : "显示";
        input.focus();
      });
    });
  }

  function startCountdown(button, seconds) {
    var again = button.dataset.again || "重新获取";
    var left = seconds;
    button.disabled = true;
    var tick = function () {
      if (left <= 0) {
        button.disabled = false;
        button.textContent = again;
        return;
      }
      button.textContent = left + " 秒后重试";
      left -= 1;
      window.setTimeout(tick, 1000);
    };
    tick();
  }

  function bindCodeSender(options) {
    var button = options.button;
    var input = options.input;
    var status = options.status;
    var requestedFor = "";

    button.addEventListener("click", function () {
      var account = normalize(input.value);
      var message = options.validate(account);
      if (message) {
        setError(input, message);
        input.focus();
        return;
      }
      setError(input, "");
      button.disabled = true;
      button.textContent = "发送中…";
      window.setTimeout(function () {
        requestedFor = account;
        if (status) status.textContent = options.sentText;
        startCountdown(button, 60);
      }, 450);
    });

    input.addEventListener("input", function () {
      if (!status || !requestedFor) return;
      if (normalize(input.value) !== requestedFor) {
        status.textContent = options.staleText || "账号已更改，请重新获取验证码。";
      }
    });

    return {
      check: function (account, code) {
        var value = normalize(account);
        var token = String(code || "").trim();
        if (!requestedFor) return "请先获取验证码";
        if (requestedFor !== value) return options.staleText || "账号已更改，请重新获取验证码";
        if (!token) return "请输入验证码";
        if (!/^\d{6}$/.test(token)) return "请输入 6 位数字验证码";
        return "";
      }
    };
  }

  function bindVisualLogins(scope) {
    scope.querySelectorAll("[data-visual-login]").forEach(function (button) {
      button.addEventListener("click", function () {
        showToast(button.getAttribute("data-visual-login") + "仅为界面演示，暂未接入");
      });
    });
  }

  function showFlash(el) {
    if (!el) return;
    var message = "";
    try {
      message = sessionStorage.getItem(FLASH_KEY) || "";
      if (message) sessionStorage.removeItem(FLASH_KEY);
    } catch (err) {
      message = "";
    }
    if (!message) return;
    el.hidden = false;
    el.textContent = message;
  }

  function initWelcome() {
    var session = readSession();
    var primary = $("#primary-action");
    var note = $("#session-note");
    if (!session || !primary) return;
    primary.textContent = "进入首页";
    primary.setAttribute("href", "home.html");
    if (note) {
      note.hidden = false;
      note.textContent = "已登录 " + maskAccount(session.account);
    }
  }

  function initLogin() {
    var form = $("#login-form");
    var account = $("#account");
    var password = $("#password");
    var remember = $("#remember");
    showFlash($("#flash"));
    bindSecretToggles(form);
    bindVisualLogins(document);
    [account, password].forEach(bindLiveClear);

    try {
      var saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        account.value = saved;
        remember.checked = true;
      }
    } catch (err) {
      /* 本地存储不可用时跳过预填 */
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var accountValue = normalize(account.value);
      var accountError = "";
      if (!accountValue) accountError = "请输入手机号或邮箱";
      else if (!isPhone(accountValue) && !isEmail(accountValue)) accountError = "请输入有效的手机号或邮箱";
      var passwordError = validatePassword(password.value, "请输入密码");
      setError(account, accountError);
      setError(password, passwordError);
      if (accountError || passwordError) {
        focusFirstInvalid(form);
        return;
      }
      try {
        if (remember.checked) localStorage.setItem(REMEMBER_KEY, accountValue);
        else localStorage.removeItem(REMEMBER_KEY);
      } catch (err) {
        /* 忽略记住账号失败 */
      }
      writeSession(accountValue);
      setLoading($("#login-submit"), "登录中…");
      window.setTimeout(function () {
        location.href = "home.html";
      }, 700);
    });
  }

  function initRegister() {
    var form = $("#register-form");
    var phone = $("#phone");
    var code = $("#code");
    var password = $("#password");
    var confirm = $("#confirm");
    var agree = $("#agree");
    var dialog = $("#legal-dialog");
    var legalTitle = $("#legal-title");
    var legalBody = $("#legal-body");
    var lastFocus = null;
    var legalCopy = {
      terms: {
        title: "用户协议",
        body: "欢迎使用拾光。本页面是可点击的界面原型，不提供真实注册或账号服务。你填写的手机号和密码只用于在这台设备上演示登录流程，不会上传到任何服务器。"
      },
      privacy: {
        title: "隐私政策",
        body: "拾光演示不会收集或传输个人信息。登录状态与「记住我」的账号保存在当前浏览器的本地存储中。退出登录或清除站点数据后，这些信息会从本机删除。"
      }
    };

    bindSecretToggles(form);
    [phone, code, password, confirm, agree].forEach(bindLiveClear);

    var sender = bindCodeSender({
      button: $("#send-code"),
      input: phone,
      status: $("#code-status"),
      sentText: "验证码已发送。演示环境可填写任意 6 位数字。",
      staleText: "手机号已更改，请重新获取验证码",
      validate: function (value) {
        if (!value) return "请输入手机号";
        if (!isPhone(value)) return "请输入 11 位中国大陆手机号";
        return "";
      }
    });

    document.querySelectorAll("[data-legal]").forEach(function (button) {
      button.addEventListener("click", function () {
        var copy = legalCopy[button.getAttribute("data-legal")];
        if (!copy || !dialog) return;
        lastFocus = button;
        legalTitle.textContent = copy.title;
        legalBody.textContent = copy.body;
        dialog.hidden = false;
        $("#legal-close").focus();
      });
    });

    function closeLegal() {
      if (!dialog || dialog.hidden) return;
      dialog.hidden = true;
      if (lastFocus) lastFocus.focus();
    }

    $("#legal-close").addEventListener("click", closeLegal);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeLegal();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeLegal();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var phoneValue = normalize(phone.value);
      var phoneError = "";
      if (!phoneValue) phoneError = "请输入手机号";
      else if (!isPhone(phoneValue)) phoneError = "请输入 11 位中国大陆手机号";
      var codeError = sender.check(phoneValue, code.value);
      var passwordError = validatePassword(password.value, "请设置密码");
      var confirmError = "";
      if (!confirm.value) confirmError = "请再次输入密码";
      else if (confirm.value !== password.value) confirmError = "两次输入的密码不一致";
      var agreeError = agree.checked ? "" : "请先阅读并同意相关协议";

      setError(phone, phoneError);
      setError(code, codeError);
      setError(password, passwordError);
      setError(confirm, confirmError);
      setError(agree, agreeError);

      if (phoneError || codeError || passwordError || confirmError || agreeError) {
        focusFirstInvalid(form);
        return;
      }

      writeSession(phoneValue);
      setLoading($("#register-submit"), "注册中…");
      window.setTimeout(function () {
        location.href = "home.html";
      }, 700);
    });
  }

  function initForgot() {
    var form = $("#forgot-form");
    var account = $("#account");
    var code = $("#code");
    var password = $("#password");
    var confirm = $("#confirm");
    bindSecretToggles(form);
    [account, code, password, confirm].forEach(bindLiveClear);

    var sender = bindCodeSender({
      button: $("#send-code"),
      input: account,
      status: $("#code-status"),
      sentText: "验证码已发送。演示环境可填写任意 6 位数字。",
      staleText: "账号已更改，请重新获取验证码",
      validate: function (value) {
        if (!value) return "请输入手机号或邮箱";
        if (!isPhone(value) && !isEmail(value)) return "请输入有效的手机号或邮箱";
        return "";
      }
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var accountValue = normalize(account.value);
      var accountError = "";
      if (!accountValue) accountError = "请输入手机号或邮箱";
      else if (!isPhone(accountValue) && !isEmail(accountValue)) accountError = "请输入有效的手机号或邮箱";
      var codeError = sender.check(accountValue, code.value);
      var passwordError = validatePassword(password.value, "请设置新密码");
      var confirmError = "";
      if (!confirm.value) confirmError = "请再次输入新密码";
      else if (confirm.value !== password.value) confirmError = "两次输入的密码不一致";

      setError(account, accountError);
      setError(code, codeError);
      setError(password, passwordError);
      setError(confirm, confirmError);

      if (accountError || codeError || passwordError || confirmError) {
        focusFirstInvalid(form);
        return;
      }

      try {
        sessionStorage.setItem(FLASH_KEY, "密码已重置，请使用新密码登录");
      } catch (err) {
        /* 无法写入提示时仍返回登录页 */
      }
      setLoading($("#forgot-submit"), "重置中…");
      window.setTimeout(function () {
        location.href = "login.html";
      }, 700);
    });
  }

  function initHome() {
    var session = readSession();
    if (!session) {
      location.replace("login.html");
      return;
    }
    var line = $("#welcome-line");
    var time = $("#login-time");
    if (line) line.textContent = "当前账号 " + maskAccount(session.account);
    if (time && session.loggedInAt) {
      var formatted = new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(session.loggedInAt));
      time.textContent = "登录时间 " + formatted;
    }
    var logout = $("#logout");
    if (!logout) return;
    logout.addEventListener("click", function () {
      clearSession();
      setLoading(logout, "正在退出…");
      window.setTimeout(function () {
        location.href = "login.html";
      }, 400);
    });
  }

  var pages = {
    welcome: initWelcome,
    login: initLogin,
    register: initRegister,
    forgot: initForgot,
    home: initHome
  };

  var init = pages[document.body.dataset.page];
  if (init) init();
})();
