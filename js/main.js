document.addEventListener('DOMContentLoaded', function() {

  initPreloader();
  initNavbar();
  initScrollAnimations();
  initMobileMenu();
  initCounters();
  initSmoothScroll();
  initTestimonialSlider();
  initFormValidation();
  initFaqAccordion();
  initScrollToTop();
  initCookieBanner();

});

function initPreloader() {
  var preloader = document.getElementById('preloader');
  if (!preloader) return;

  window.addEventListener('load', function() {
    setTimeout(function() {
      preloader.classList.add('loaded');
      setTimeout(function() {
        preloader.style.display = 'none';
      }, 500);
    }, 600);
  });
}

function initNavbar() {
  var navbar = document.querySelector('.navbar');
  if (!navbar) return;

  window.addEventListener('scroll', function() {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

function initScrollAnimations() {
  var elements = document.querySelectorAll('.fade-up, .scale-in');
  if (elements.length === 0) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(function(el) {
    observer.observe(el);
  });
}

function initMobileMenu() {
  var hamburger = document.querySelector('.hamburger');
  var mobileMenu = document.querySelector('.mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', function() {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
  });

  var links = mobileMenu.querySelectorAll('a');
  links.forEach(function(link) {
    link.addEventListener('click', function() {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

function initCounters() {
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length === 0) return;

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(function(counter) {
    observer.observe(counter);
  });
}

function animateCounter(el) {
  var target = parseInt(el.getAttribute('data-count'));
  var suffix = el.getAttribute('data-suffix') || '';
  var prefix = el.getAttribute('data-prefix') || '';
  var duration = 2000;
  var startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.floor(eased * target);
    el.textContent = prefix + current.toLocaleString('tr-TR') + suffix;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = prefix + target.toLocaleString('tr-TR') + suffix;
    }
  }

  requestAnimationFrame(step);
}

function initSmoothScroll() {
  var links = document.querySelectorAll('a[href^="#"]');
  links.forEach(function(link) {
    link.addEventListener('click', function(e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        var offset = 80;
        var top = targetEl.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });
}

function initTestimonialSlider() {
  var track = document.querySelector('.testimonial-track');
  if (!track) return;

  var cards = track.querySelectorAll('.ref-card');
  var prevBtn = document.querySelector('.slider-prev');
  var nextBtn = document.querySelector('.slider-next');
  var dots = document.querySelectorAll('.slider-dot');
  var currentIndex = 0;
  var cardsPerView = getCardsPerView();

  function getCardsPerView() {
    if (window.innerWidth < 768) return 1;
    if (window.innerWidth < 1024) return 2;
    return 3;
  }

  function updateSlider() {
    var maxIndex = Math.max(0, cards.length - cardsPerView);
    if (currentIndex > maxIndex) currentIndex = maxIndex;
    var gap = 24;
    var cardWidth = (track.parentElement.offsetWidth - gap * (cardsPerView - 1)) / cardsPerView;
    var offset = currentIndex * (cardWidth + gap);
    track.style.transform = 'translateX(-' + offset + 'px)';

    if (dots.length > 0) {
      dots.forEach(function(dot, i) {
        dot.classList.toggle('active', i === currentIndex);
      });
    }
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', function() {
      var maxIndex = Math.max(0, cards.length - cardsPerView);
      if (currentIndex < maxIndex) {
        currentIndex++;
        updateSlider();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', function() {
      if (currentIndex > 0) {
        currentIndex--;
        updateSlider();
      }
    });
  }

  window.addEventListener('resize', function() {
    cardsPerView = getCardsPerView();
    updateSlider();
  });
}

function initFormValidation() {
  var form = document.getElementById('analysisForm');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var valid = true;
    var requiredFields = form.querySelectorAll('[required]');

    requiredFields.forEach(function(field) {
      var errorEl = field.parentElement.querySelector('.field-error');
      if (errorEl) errorEl.remove();

      if (!field.value.trim()) {
        valid = false;
        field.style.borderColor = 'var(--red-600)';
        var error = document.createElement('span');
        error.className = 'field-error';
        error.style.color = 'var(--red-400)';
        error.style.fontSize = '0.8rem';
        error.style.marginTop = '4px';
        error.style.display = 'block';
        error.textContent = 'Bu alan zorunludur';
        field.parentElement.appendChild(error);
      } else {
        field.style.borderColor = '';
      }
    });

    var emailField = form.querySelector('[type="email"]');
    if (emailField && emailField.value.trim()) {
      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(emailField.value.trim())) {
        valid = false;
        emailField.style.borderColor = 'var(--red-600)';
        var existingError = emailField.parentElement.querySelector('.field-error');
        if (existingError) existingError.remove();
        var error = document.createElement('span');
        error.className = 'field-error';
        error.style.color = 'var(--red-400)';
        error.style.fontSize = '0.8rem';
        error.style.marginTop = '4px';
        error.style.display = 'block';
        error.textContent = 'Geçerli bir e-posta adresi girin';
        emailField.parentElement.appendChild(error);
      }
    }

    if (valid) {
      var formCard = document.querySelector('.form-content');
      var successCard = document.querySelector('.form-success');
      if (formCard && successCard) {
        formCard.style.display = 'none';
        successCard.classList.add('active');
      }
    }
  });

  var inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach(function(input) {
    input.addEventListener('input', function() {
      this.style.borderColor = '';
      var errorEl = this.parentElement.querySelector('.field-error');
      if (errorEl) errorEl.remove();
    });
  });
}

function initFaqAccordion() {
  var faqItems = document.querySelectorAll('.faq-item');
  if (faqItems.length === 0) return;

  faqItems.forEach(function(item) {
    var question = item.querySelector('.faq-question');
    question.addEventListener('click', function() {
      var isActive = item.classList.contains('active');

      faqItems.forEach(function(other) {
        other.classList.remove('active');
      });

      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

function initScrollToTop() {
  var scrollBtn = document.getElementById('scrollTop');
  if (!scrollBtn) return;

  window.addEventListener('scroll', function() {
    if (window.scrollY > 400) {
      scrollBtn.classList.add('visible');
    } else {
      scrollBtn.classList.remove('visible');
    }
  });

  scrollBtn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function initCookieBanner() {
  var banner = document.getElementById('cookieBanner');
  var acceptBtn = document.getElementById('cookieAccept');
  if (!banner || !acceptBtn) return;

  if (localStorage.getItem('cookieAccepted')) return;

  setTimeout(function() {
    banner.classList.add('visible');
  }, 2000);

  acceptBtn.addEventListener('click', function() {
    banner.classList.remove('visible');
    banner.classList.add('hidden');
    localStorage.setItem('cookieAccepted', 'true');
  });
}
