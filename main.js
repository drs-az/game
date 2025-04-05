window.addEventListener('load', () => {
  // Register service worker for PWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js');
  }

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let score = 0;
  let targets = [];

  // Create targets for the game
  function spawnTarget() {
    const x = Math.random() * (canvas.width - 30) + 15;
    const y = Math.random() * (canvas.height - 30) + 15;
    targets.push({x, y, radius: 15});
  }

  // Draw targets and display score
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    targets.forEach(t => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#f00';
      ctx.fill();
    });
    ctx.fillStyle = '#000';
    ctx.font = '20px Arial';
    ctx.fillText('Score: ' + score, 10, 25);
  }

  // Game loop
  function update() {
    draw();
    requestAnimationFrame(update);
  }
  update();

  // Secret unlock mechanism: click in the top-left corner 5 times
  let secretClicks = 0;
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // If click is in top-left corner, count towards secret unlock
    if (x < 50 && y < 50) {
      secretClicks++;
      if (secretClicks >= 5) {
        showEncryptionPanel();
        secretClicks = 0;
      }
    }
    
    // Check if a target is hit
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const dist = Math.hypot(x - t.x, y - t.y);
      if (dist < t.radius) {
        score++;
        targets.splice(i, 1);
        spawnTarget();
        break;
      }
    }
  });

  // Spawn initial targets
  for (let i = 0; i < 3; i++) {
    spawnTarget();
  }

  // Encryption panel UI elements
  const encryptionPanel = document.getElementById('encryptionPanel');
  const encryptBtn = document.getElementById('encryptBtn');
  const decryptBtn = document.getElementById('decryptBtn');
  const shareBtn = document.getElementById('shareBtn');
  const closePanel = document.getElementById('closePanel');
  const passphraseInput = document.getElementById('passphrase');
  const messageInput = document.getElementById('message');
  const resultArea = document.getElementById('result');

  function showEncryptionPanel() {
    encryptionPanel.style.display = 'block';
  }
  
  function hideEncryptionPanel() {
    encryptionPanel.style.display = 'none';
  }

  // Utility: Derive an AES-GCM key from a passphrase and salt using PBKDF2
  async function getKeyFromPassphrase(passphrase, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(passphrase),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // Encrypt the message using AES-GCM
  async function encryptMessage(message, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getKeyFromPassphrase(passphrase, salt);
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(message)
    );
    // Combine salt, iv, and ciphertext into one buffer
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
    // Convert to Base64 for easy sharing
    return btoa(String.fromCharCode(...combined));
  }

  // Decrypt the message using AES-GCM
  async function decryptMessage(encryptedMessage, passphrase) {
    const combinedStr = atob(encryptedMessage);
    const combined = new Uint8Array([...combinedStr].map(c => c.charCodeAt(0)));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    const key = await getKeyFromPassphrase(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data
    );
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  // Hook up the encryption button
  encryptBtn.addEventListener('click', async () => {
    const message = messageInput.value;
    const passphrase = passphraseInput.value;
    if (!message || !passphrase) {
      alert("Please enter both a message and a passphrase.");
      return;
    }
    try {
      const encrypted = await encryptMessage(message, passphrase);
      resultArea.value = encrypted;
    } catch (err) {
      alert("Encryption failed: " + err.message);
    }
  });

  // Hook up the decryption button
  decryptBtn.addEventListener('click', async () => {
    const encryptedMessage = messageInput.value;
    const passphrase = passphraseInput.value;
    if (!encryptedMessage || !passphrase) {
      alert("Please enter the encrypted text and the passphrase.");
      return;
    }
    try {
      const decrypted = await decryptMessage(encryptedMessage, passphrase);
      resultArea.value = decrypted;
    } catch (err) {
      alert("Decryption failed: " + err.message);
    }
  });

  // Use the Web Share API to allow sharing the result via SMS and other apps
  shareBtn.addEventListener('click', async () => {
    const textToShare = resultArea.value;
    if (!textToShare) {
      alert("Nothing to share!");
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Secret Message',
          text: textToShare
        });
      } catch (err) {
        alert("Sharing failed: " + err.message);
      }
    } else {
      alert("Sharing is not supported on this device.");
    }
  });

  // Close the encryption panel
  closePanel.addEventListener('click', hideEncryptionPanel);
});
