import { firebaseConfig, ADMIN_UIDS } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, updateDoc, doc, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js';

var app = initializeApp(firebaseConfig);
var auth = getAuth(app);
var db = getFirestore(app);
var storage = getStorage(app);

// =============================================
// SECURITY: Rate Limiting & Session Timeout
// =============================================
var LOGIN_MAX_ATTEMPTS = 5;
var LOGIN_LOCKOUT_MS = 60000;
var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min

var loginAttempts = 0;
var lockoutUntil = 0;
var sessionTimer = null;

function resetSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(function() {
    signOut(auth);
    alert('Güvenlik nedeniyle oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.');
  }, SESSION_TIMEOUT_MS);
}

function clearSessionTimer() {
  clearTimeout(sessionTimer);
  sessionTimer = null;
}

// Track user activity to reset session timer
['click', 'keydown', 'scroll', 'mousemove'].forEach(function(evt) {
  document.addEventListener(evt, function() {
    if (sessionTimer) resetSessionTimer();
  }, { passive: true });
});

// =============================================
// DOM ELEMENTS
// =============================================
var loginScreen = document.getElementById('loginScreen');
var dashboard = document.getElementById('dashboard');
var loginForm = document.getElementById('loginForm');
var loginError = document.getElementById('loginError');
var loginBtn = document.getElementById('loginBtn');
var logoutBtn = document.getElementById('logoutBtn');
var adminEmail = document.getElementById('adminEmail');
var resourceModal = document.getElementById('resourceModal');
var resourceForm = document.getElementById('resourceForm');
var resourcesList = document.getElementById('resourcesList');
var addResourceBtn = document.getElementById('addResourceBtn');
var cancelModal = document.getElementById('cancelModal');
var closeModal = document.getElementById('closeModal');
var modalTitle = document.getElementById('modalTitle');
var uploadProgress = document.getElementById('uploadProgress');
var uploadProgressBar = document.getElementById('uploadProgressBar');
var uploadProgressText = document.getElementById('uploadProgressText');
var submitBtn = document.getElementById('submitBtn');
var totalResourcesEl = document.getElementById('totalResources');
var fileInput = document.getElementById('resFile');
var fileLabel = document.getElementById('fileLabel');
var thumbnailInput = document.getElementById('resThumbnail');
var thumbnailLabel = document.getElementById('thumbnailLabel');
var videoUrlInput = document.getElementById('resVideoUrl');
var adminSearchInput = document.getElementById('adminSearch');

// Edit state
var editingId = null;
var editingData = null;
var allResources = []; // Store for search filtering

// =============================================
// SEARCH
// =============================================
adminSearchInput.addEventListener('input', function() {
  var query = this.value.trim().toLowerCase();
  if (!query) {
    renderResources(allResources);
    return;
  }
  var filtered = allResources.filter(function(r) {
    return (r.title || '').toLowerCase().indexOf(query) !== -1
      || (r.description || '').toLowerCase().indexOf(query) !== -1
      || (r.category || '').toLowerCase().indexOf(query) !== -1;
  });
  renderResources(filtered);
});

// =============================================
// AUTH STATE
// =============================================
onAuthStateChanged(auth, function(user) {
  if (user && ADMIN_UIDS.includes(user.uid)) {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    adminEmail.textContent = user.email;
    resetSessionTimer();
    loadResources();
  } else if (user) {
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    loginError.textContent = 'Bu hesabın admin yetkisi yoxdur!';
    loginError.style.display = 'block';
    clearSessionTimer();
    signOut(auth);
  } else {
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    clearSessionTimer();
  }
});

// =============================================
// LOGIN WITH RATE LIMITING
// =============================================
loginForm.addEventListener('submit', function(e) {
  e.preventDefault();

  // Rate limiting check
  var now = Date.now();
  if (now < lockoutUntil) {
    var remainSec = Math.ceil((lockoutUntil - now) / 1000);
    loginError.textContent = 'Çok fazla deneme! ' + remainSec + ' saniye bekleyin.';
    loginError.style.display = 'block';
    return;
  }

  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;

  // SECURITY: Basic input validation
  if (!email || !password) {
    loginError.textContent = 'E-posta ve şifre alanları boş bırakılamaz!';
    loginError.style.display = 'block';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="admin-spinner"></span> Giriş yapılıyor...';
  loginError.style.display = 'none';

  signInWithEmailAndPassword(auth, email, password)
    .then(function() {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Giriş Yap';
      loginAttempts = 0; // Reset on success
    })
    .catch(function(error) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Giriş Yap';
      loginAttempts++;

      // Lock out after too many attempts
      if (loginAttempts >= LOGIN_MAX_ATTEMPTS) {
        lockoutUntil = Date.now() + LOGIN_LOCKOUT_MS;
        loginError.textContent = 'Çok fazla hatalı deneme! 60 saniye bekleyin.';
        loginAttempts = 0;
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        loginError.textContent = 'E-posta veya şifre hatalı! (' + (LOGIN_MAX_ATTEMPTS - loginAttempts) + ' deneme kaldı)';
      } else if (error.code === 'auth/user-not-found') {
        loginError.textContent = 'E-posta veya şifre hatalı!'; // Don't reveal user existence
      } else if (error.code === 'auth/too-many-requests') {
        loginError.textContent = 'Çok fazla deneme! Lütfen biraz bekleyin.';
      } else {
        loginError.textContent = 'Giriş hatası oluştu. Lütfen tekrar deneyin.'; // Don't expose raw error
      }
      loginError.style.display = 'block';
    });
});

logoutBtn.addEventListener('click', function() {
  clearSessionTimer();
  signOut(auth);
});

// =============================================
// THUMBNAIL — Manual Only
// =============================================
thumbnailInput.addEventListener('change', function() {
  if (this.files.length > 0) {
    var file = this.files[0];
    // SECURITY: Validate file type
    var allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      alert('Sadece JPG, PNG, WebP veya GIF formatları kabul edilir!');
      this.value = '';
      return;
    }
    // SECURITY: Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Kapak görseli maksimum 5MB olabilir!');
      this.value = '';
      return;
    }
    thumbnailLabel.innerHTML = '✅ ' + sanitizeText(file.name);
  } else {
    resetThumbnailLabel();
  }
});

function resetThumbnailLabel() {
  thumbnailLabel.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;margin-bottom:6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>' +
    '<span>JPG, PNG, WebP</span>';
  thumbnailLabel.classList.remove('admin-file-label-warning');
}

function resetFileLabel() {
  fileLabel.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;margin-bottom:6px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' +
    '<span>PDF, DOCX, vb.</span>';
}

// =============================================
// LOAD RESOURCES
// =============================================
function loadResources() {
  resourcesList.innerHTML = '<div class="admin-loading"><span class="admin-spinner"></span> Kaynaklar yükleniyor...</div>';
  adminSearchInput.value = '';
  var q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));

  getDocs(q).then(function(snapshot) {
    allResources = [];
    snapshot.forEach(function(docSnap) {
      allResources.push({ id: docSnap.id, ...docSnap.data() });
    });
    totalResourcesEl.textContent = allResources.length;
    renderResources(allResources);
  }).catch(function() {
    resourcesList.innerHTML = '<div class="admin-empty"><p>Veriler yüklenirken bir hata oluştu.</p></div>';
  });
}

function renderResources(resources) {
  if (resources.length === 0) {
    resourcesList.innerHTML =
      '<div class="admin-empty">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>' +
        '<h3>' + (adminSearchInput.value ? 'Sonuç bulunamadı' : 'Henüz kaynak eklenmemiş') + '</h3>' +
        '<p>' + (adminSearchInput.value ? '"' + sanitizeText(adminSearchInput.value) + '" ile eşleşen kaynak yok.' : '"Yeni Kaynak Ekle" butonuna tıklayarak ilk kaynağınızı ekleyin.') + '</p>' +
      '</div>';
    return;
  }

  var categoryLabels = { pdf: 'PDF Rehber', checklist: 'Checklist', ebook: 'E-Kitap' };
  var categoryColors = { pdf: 'admin-tag-pdf', checklist: 'admin-tag-checklist', ebook: 'admin-tag-ebook' };

  var html = '';
  resources.forEach(function(r) {
    var date = r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : 'Tarih yok';
    var thumbHtml = r.thumbnailUrl ? '<img src="' + sanitizeAttr(r.thumbnailUrl) + '" alt="' + sanitizeAttr(r.title || '') + '" class="admin-res-thumb" loading="lazy">' : '';

    html +=
      '<div class="admin-res-card">' +
        thumbHtml +
        '<div class="admin-res-info">' +
          '<div class="admin-res-top">' +
            '<span class="admin-res-tag ' + (categoryColors[r.category] || '') + '">' + sanitizeText(categoryLabels[r.category] || r.category || '') + '</span>' +
            '<span class="admin-res-date">' + date + '</span>' +
          '</div>' +
          '<h3>' + sanitizeText(r.title || '') + '</h3>' +
          '<p>' + sanitizeText(r.description || '') + '</p>' +
          (r.fileSize ? '<span class="admin-res-size">📎 ' + sanitizeText(r.fileSize) + '</span>' : '') +
        '</div>' +
        '<div class="admin-res-actions">' +
          '<button class="admin-btn-edit" data-rid="' + sanitizeAttr(r.id) + '" title="Düzenle">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>' +
          '</button>' +
          '<button class="admin-btn-delete" data-rid="' + sanitizeAttr(r.id) + '" title="Sil">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
  });

  resourcesList.innerHTML = html;

  // Store resources data in memory for edit
  var resourceMap = {};
  allResources.forEach(function(r) { resourceMap[r.id] = r; });

  // Attach edit listeners
  resourcesList.querySelectorAll('.admin-btn-edit').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var rid = this.getAttribute('data-rid');
      if (resourceMap[rid]) openEditModal(resourceMap[rid]);
    });
  });

  // Attach delete listeners
  resourcesList.querySelectorAll('.admin-btn-delete').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var rid = this.getAttribute('data-rid');
      if (resourceMap[rid]) {
        deleteResource(rid, resourceMap[rid].filePath || '', resourceMap[rid].thumbnailPath || '');
      }
    });
  });
}

// =============================================
// ADD / EDIT MODAL
// =============================================
addResourceBtn.addEventListener('click', function() {
  editingId = null;
  editingData = null;
  resourceForm.reset();
  resetThumbnailLabel();
  resetFileLabel();
  uploadProgress.style.display = 'none';
  modalTitle.textContent = 'Yeni Kaynak Ekle';
  submitBtn.textContent = 'Kaydet';
  resourceModal.classList.add('active');
  document.body.style.overflow = 'hidden';
});

function openEditModal(data) {
  editingId = data.id;
  editingData = data;
  document.getElementById('resTitle').value = data.title || '';
  document.getElementById('resDescription').value = data.description || '';
  document.getElementById('resCategory').value = data.category || '';
  videoUrlInput.value = data.videoUrl || '';

  // Show existing thumbnail
  if (data.thumbnailUrl) {
    thumbnailLabel.innerHTML = '<img src="' + sanitizeAttr(data.thumbnailUrl) + '" alt="" style="width:100%;max-height:80px;object-fit:cover;border-radius:8px;"><span style="margin-top:4px;font-size:0.72rem;">Mevcut kapak görseli</span>';
  } else {
    resetThumbnailLabel();
  }

  // Show existing file info
  if (data.fileName) {
    fileLabel.innerHTML = '📎 ' + sanitizeText(data.fileName) + (data.fileSize ? ' (' + data.fileSize + ')' : '');
  } else {
    resetFileLabel();
  }

  uploadProgress.style.display = 'none';
  modalTitle.textContent = 'Kaynağı Düzenle';
  submitBtn.textContent = 'Güncelle';
  resourceModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

cancelModal.addEventListener('click', closeModalFn);
closeModal.addEventListener('click', closeModalFn);
resourceModal.addEventListener('click', function(e) {
  if (e.target === resourceModal) closeModalFn();
});

// SECURITY: Escape key closes modal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && resourceModal.classList.contains('active')) {
    closeModalFn();
  }
});

function closeModalFn() {
  resourceModal.classList.remove('active');
  document.body.style.overflow = '';
}

fileInput.addEventListener('change', function() {
  if (this.files.length > 0) {
    var file = this.files[0];
    // SECURITY: Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      alert('Dosya maksimum 25MB olabilir!');
      this.value = '';
      return;
    }
    var sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    fileLabel.textContent = file.name + ' (' + sizeMB + ' MB)';
  } else if (editingData && editingData.fileName) {
    fileLabel.innerHTML = '📎 ' + sanitizeText(editingData.fileName);
  } else {
    resetFileLabel();
  }
});

// =============================================
// FORM SUBMIT (CREATE OR UPDATE)
// =============================================
var isSubmitting = false;

resourceForm.addEventListener('submit', function(e) {
  e.preventDefault();
  if (isSubmitting) return; // Prevent double submit

  var title = document.getElementById('resTitle').value.trim();
  var description = document.getElementById('resDescription').value.trim();
  var category = document.getElementById('resCategory').value;
  var videoUrl = videoUrlInput.value.trim();
  var file = fileInput.files[0];
  var thumbnail = thumbnailInput.files[0];

  // SECURITY: Input validation
  if (!title || !category) {
    alert('Başlık ve kategori zorunludur!');
    return;
  }
  if (title.length > 200) {
    alert('Başlık maksimum 200 karakter olabilir!');
    return;
  }
  if (description.length > 1000) {
    alert('Açıklama maksimum 1000 karakter olabilir!');
    return;
  }
  if (videoUrl && !isValidUrl(videoUrl)) {
    alert('Geçerli bir video URL\'si girin!');
    return;
  }

  isSubmitting = true;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="admin-spinner"></span> ' + (editingId ? 'Güncelleniyor...' : 'Kaydediliyor...');

  var uploads = [];

  // Determine thumbnail
  var finalThumbnailUrl = (editingData ? editingData.thumbnailUrl : '') || '';
  var finalThumbnailPath = (editingData ? editingData.thumbnailPath : '') || '';

  if (thumbnail) {
    finalThumbnailPath = 'thumbnails/' + Date.now() + '_' + sanitizeFileName(thumbnail.name);
    var thumbRef = ref(storage, finalThumbnailPath);
    uploads.push(
      uploadBytesResumable(thumbRef, thumbnail).then(function(snap) {
        return getDownloadURL(snap.ref);
      }).then(function(url) {
        finalThumbnailUrl = url;
      })
    );
  }

  // Determine file
  var finalFileUrl = (editingData ? editingData.fileUrl : '') || '';
  var finalFileSize = (editingData ? editingData.fileSize : '') || '';
  var finalFileName = (editingData ? editingData.fileName : '') || '';
  var finalFilePath = (editingData ? editingData.filePath : '') || '';

  if (file) {
    finalFilePath = 'resources/' + Date.now() + '_' + sanitizeFileName(file.name);
    var fileRef = ref(storage, finalFilePath);
    var uploadTask = uploadBytesResumable(fileRef, file);
    finalFileSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    finalFileName = file.name;

    uploadProgress.style.display = 'block';

    var fileUploadPromise = new Promise(function(resolve, reject) {
      uploadTask.on('state_changed',
        function(snapshot) {
          var progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          uploadProgressBar.style.width = progress + '%';
          uploadProgressText.textContent = '%' + progress + ' yüklendi';
        },
        function(error) { reject(error); },
        function() {
          getDownloadURL(uploadTask.snapshot.ref).then(function(url) {
            finalFileUrl = url;
            resolve();
          });
        }
      );
    });
    uploads.push(fileUploadPromise);
  }

  Promise.all(uploads).then(function() {
    var docData = {
      title: title,
      description: description,
      category: category,
      videoUrl: videoUrl,
      fileUrl: finalFileUrl,
      fileSize: finalFileSize,
      fileName: finalFileName,
      filePath: finalFilePath,
      thumbnailUrl: finalThumbnailUrl,
      thumbnailPath: finalThumbnailPath
    };

    if (editingId) {
      return updateDoc(doc(db, 'resources', editingId), docData);
    } else {
      docData.createdAt = serverTimestamp();
      return addDoc(collection(db, 'resources'), docData);
    }
  }).then(function() {
    resetFormState();
    closeModalFn();
    loadResources();
    showToast(editingId ? 'Kaynak güncellendi!' : 'Kaynak başarıyla eklendi!');
    editingId = null;
    editingData = null;
  }).catch(function() {
    alert('İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    resetFormState();
  });
});

function resetFormState() {
  isSubmitting = false;
  submitBtn.disabled = false;
  submitBtn.textContent = editingId ? 'Güncelle' : 'Kaydet';
  uploadProgress.style.display = 'none';
}

// =============================================
// DELETE
// =============================================
function deleteResource(id, filePath, thumbnailPath) {
  if (!confirm('Bu kaynağı silmek istediğinize emin misiniz?')) return;

  deleteDoc(doc(db, 'resources', id)).then(function() {
    if (filePath) deleteObject(ref(storage, filePath)).catch(function() {});
    if (thumbnailPath) deleteObject(ref(storage, thumbnailPath)).catch(function() {});
    loadResources();
    showToast('Kaynak silindi.');
  }).catch(function() {
    alert('Silme işlemi sırasında bir hata oluştu.');
  });
}

// =============================================
// SECURITY UTILITIES
// =============================================
function sanitizeText(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function sanitizeAttr(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sanitizeFileName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isValidUrl(string) {
  try {
    var url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function showToast(message) {
  var toast = document.getElementById('adminToast');
  toast.textContent = message;
  toast.classList.add('active');
  setTimeout(function() { toast.classList.remove('active'); }, 3000);
}
