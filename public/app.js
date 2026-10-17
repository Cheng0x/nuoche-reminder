(() => {
  'use strict';

  const DEFAULT_TEXT = '麻烦挪一下车';

  const els = {
    chips: document.querySelectorAll('.chip'),
    customInput: document.getElementById('customInput'),
    phoneInput: document.getElementById('phoneInput'),
    sendBtn: document.getElementById('sendBtn'),
    sendText: document.querySelector('.btn-primary__text'),
    spinner: document.querySelector('#sendBtn .spinner'),
    toast: document.getElementById('toast'),
    yizhengBtn: document.getElementById('yizhengBtn'),
    sheetMask: document.getElementById('sheetMask'),
    sheetClose: document.getElementById('sheetClose'),
    buyBtn: document.getElementById('buyBtn'),
    modalMask: document.getElementById('modalMask'),
    modalClose: document.getElementById('modalClose'),
  };

  let toastTimer = null;

  // ===== Toast =====
  function showToast(message, type = '') {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.className = 'toast is-show' + (type ? ` is-${type}` : '');
    toastTimer = setTimeout(() => {
      els.toast.className = 'toast';
    }, 2600);
  }

  // ===== 话术选择 =====
  let selectedChip = els.chips[0] || null;

  function getSelectedText() {
    const custom = els.customInput.value.trim();
    if (custom) return custom;
    return selectedChip ? selectedChip.dataset.text : DEFAULT_TEXT;
  }

  function syncChips() {
    const hasCustom = !!els.customInput.value.trim();
    els.chips.forEach((chip) => {
      const active = !hasCustom && chip === selectedChip;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-checked', String(active));
    });
  }

  els.chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      // 用户主动点 chip 时清空自定义输入，避免两套状态打架
      els.customInput.value = '';
      selectedChip = chip;
      syncChips();
    });
  });

  els.customInput.addEventListener('input', syncChips);

  // 初始选中第一条
  syncChips();

  // ===== 发送 =====
  function setLoading(loading) {
    els.sendBtn.disabled = loading;
    els.spinner.hidden = !loading;
    els.sendText.hidden = loading;
    els.sendBtn.classList.remove('is-success');
  }

  function setSuccess(label) {
    els.sendBtn.disabled = false;
    els.spinner.hidden = true;
    els.sendText.hidden = false;
    els.sendText.textContent = label || '已发送';
    els.sendBtn.classList.add('is-success');
    setTimeout(() => {
      els.sendText.textContent = '发送挪车提醒';
      els.sendBtn.classList.remove('is-success');
    }, 2600);
  }

  els.sendBtn.addEventListener('click', async () => {
    const text = getSelectedText();
    const phone = els.phoneInput.value.trim();

    // 手机号可选；填了则做轻校验（11 位，1 开头）
    if (phone && !/^1\d{10}$/.test(phone)) {
      showToast('请输入正确的手机号', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || '通知失败');
      }
      setLoading(false);
      setSuccess('已通知车主');
      showToast('已通知车主', 'success');
    } catch (err) {
      setLoading(false);
      showToast('通知失败，请稍后重试', 'error');
    }
  });

  // ===== 底部弹窗 / 弹窗 通用控制 =====
  function openSheet(mask) {
    mask.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => mask.classList.add('is-open')));
  }

  function closeSheet(mask) {
    mask.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => {
      mask.hidden = true;
    }, 260);
  }

  els.yizhengBtn.addEventListener('click', () => openSheet(els.sheetMask));
  els.sheetClose.addEventListener('click', () => closeSheet(els.sheetMask));
  els.sheetMask.addEventListener('click', (e) => {
    if (e.target === els.sheetMask) closeSheet(els.sheetMask);
  });

  els.buyBtn.addEventListener('click', () => openSheet(els.modalMask));
  els.modalClose.addEventListener('click', () => closeSheet(els.modalMask));
  els.modalMask.addEventListener('click', (e) => {
    if (e.target === els.modalMask) closeSheet(els.modalMask);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.sheetMask.hidden) closeSheet(els.sheetMask);
    if (!els.modalMask.hidden) closeSheet(els.modalMask);
  });
})();
