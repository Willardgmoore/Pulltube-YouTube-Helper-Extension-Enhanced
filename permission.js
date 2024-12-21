document.addEventListener('DOMContentLoaded', () => {
    const alwaysAllowCheckbox = document.getElementById('always-allow');
    const allowButton = document.getElementById('allow');
    const cancelButton = document.getElementById('cancel');

    allowButton.addEventListener('click', async () => {
        const alwaysAllow = alwaysAllowCheckbox.checked;
        if (alwaysAllow) {
            await chrome.storage.local.set({ 'pulltube_always_allow': true });
        }
        chrome.runtime.sendMessage({ 
            action: 'permission_granted',
            alwaysAllow: alwaysAllow 
        });
        window.close();
    });

    cancelButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'permission_denied' });
        window.close();
    });
}); 