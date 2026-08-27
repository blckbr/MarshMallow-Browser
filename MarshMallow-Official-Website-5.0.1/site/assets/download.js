(() => {
  const button = document.getElementById('download-button');
  if (!button) return;
  const version = document.getElementById('release-version');
  const size = document.getElementById('release-size');
  const sha = document.getElementById('release-sha256');
  const copyHash = document.getElementById('copy-hash');
  const unavailable = document.getElementById('release-unavailable');
  const progress = document.getElementById('download-progress');
  const progressBar = document.getElementById('download-progress-bar');
  const progressLabel = document.getElementById('download-progress-label');
  const managerDownloadButton = document.getElementById('manager-download-button');
  const managerStatus = document.getElementById('manager-status');

  let release = null;
  let manager = null;

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
    return `${n.toFixed(i >= 2 ? 2 : 1)} ${units[i]}`;
  };

  const setProgress = (done, total, label) => {
    progress.hidden = false;
    const pct = total > 0 ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
    progressBar.style.width = `${pct}%`;
    progressLabel.textContent = label || `${Math.round(pct)}%`;
  };

  const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  async function loadRelease() {
    try {
      const response = await fetch(`/download/release.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      release = await response.json();
      if (release.version) version.textContent = release.version;
      if (release.size) size.textContent = release.sizeHuman || formatBytes(release.size);
      if (release.sha256) {
        sha.textContent = release.sha256;
        copyHash.disabled = false;
      }
      if (!release.available) {
        unavailable.hidden = false;
        button.textContent = 'Instalador em preparação';
        button.disabled = true;
        return;
      }
      button.disabled = false;
      button.textContent = `Baixar MarshMallow ${release.version}`;
    } catch (err) {
      console.error(err);
      unavailable.hidden = false;
      button.textContent = 'Download temporariamente indisponível';
      button.disabled = true;
    }
  }

  const validManagerUrl = (candidate, versionValue) => {
    try {
      const parsed = new URL(String(candidate || ''));
      const versionText = String(versionValue || '');
      return parsed.protocol === 'https:'
        && parsed.hostname === 'github.com'
        && parsed.pathname === `/blckbr/MarshMallow-Downloader-Manager/releases/download/v${versionText}/MarshMallow-Downloader-Manager-Setup-${versionText}.exe`;
    } catch { return false; }
  };

  async function loadDownloaderManager() {
    if (!managerDownloadButton) return;
    try {
      const response = await fetch(`/download/manager.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      manager = await response.json();
      const usable = manager.available === true
        && manager.protocol === 'marshmallow-downloader'
        && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(manager.version || ''))
        && validManagerUrl(manager.url, manager.version);
      if (!usable) {
        managerDownloadButton.disabled = true;
        managerDownloadButton.textContent = 'Downloader Manager em desenvolvimento';
        if (managerStatus) managerStatus.textContent = manager.message || 'Em desenvolvimento. O gerenciador integrado continua sendo o padrão.';
        return;
      }
      managerDownloadButton.disabled = false;
      managerDownloadButton.textContent = `Baixar Downloader Manager ${manager.version}`;
      if (managerStatus) managerStatus.textContent = 'Disponível como opção. O gerenciador integrado do navegador continua funcionando normalmente.';
    } catch (err) {
      console.error(err);
      manager = null;
      managerDownloadButton.disabled = true;
      managerDownloadButton.textContent = 'Downloader Manager indisponível';
      if (managerStatus) managerStatus.textContent = 'Não foi possível consultar a integração agora. O navegador continua usando o gerenciador integrado.';
    }
  }

  managerDownloadButton?.addEventListener('click', () => {
    if (!manager?.available || !validManagerUrl(manager.url, manager.version)) return;
    window.location.href = manager.url;
  });

  copyHash?.addEventListener('click', async () => {
    if (!release?.sha256) return;
    try {
      await navigator.clipboard.writeText(release.sha256);
      const old = copyHash.textContent;
      copyHash.textContent = 'Copiado';
      setTimeout(() => { copyHash.textContent = old; }, 1500);
    } catch {
      window.prompt('Copie o SHA-256:', release.sha256);
    }
  });

  button.addEventListener('click', async () => {
    if (!release?.available) return;
    button.disabled = true;
    const original = button.textContent;
    try {
      if (release.mode === 'direct' && release.url) {
        window.location.href = release.url;
        return;
      }

      const chunks = Array.isArray(release.chunks) ? release.chunks : [];
      if (!chunks.length) throw new Error('Nenhuma parte do instalador foi publicada.');
      const blobs = [];
      let received = 0;
      const total = Number(release.size) || 0;
      for (let i = 0; i < chunks.length; i += 1) {
        setProgress(received, total, `Baixando parte ${i + 1} de ${chunks.length}…`);
        const response = await fetch(chunks[i], { cache: 'force-cache' });
        if (!response.ok) throw new Error(`Falha ao baixar a parte ${i + 1} (HTTP ${response.status}).`);
        const blob = await response.blob();
        blobs.push(blob);
        received += blob.size;
        setProgress(received, total, `${Math.round((received / total) * 100)}% · ${formatBytes(received)} de ${formatBytes(total)}`);
      }
      setProgress(total, total, 'Download concluído. Verificando integridade…');
      const installerBlob = new Blob(blobs, { type: 'application/vnd.microsoft.portable-executable' });
      if (release.sha256 && window.crypto?.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', await installerBlob.arrayBuffer());
        const actualHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
        if (actualHash.toLowerCase() !== String(release.sha256).toLowerCase()) {
          throw new Error('A verificação SHA-256 falhou. O instalador não será salvo.');
        }
      }
      setProgress(total, total, 'Integridade confirmada. Preparando o instalador…');
      saveBlob(installerBlob, release.fileName);
      progressLabel.textContent = 'Instalador pronto e SHA-256 confirmado.';
    } catch (err) {
      console.error(err);
      progress.hidden = false;
      progressLabel.textContent = `Erro: ${err.message || err}`;
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  });

  loadRelease();
  loadDownloaderManager();
})();
