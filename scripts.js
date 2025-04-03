document.addEventListener('DOMContentLoaded', () => {
  // --- Elements ---
  const coordinatesDisplay = document.getElementById('coordinates-display');
  const siteTitle = document.querySelector('.site-title');
  const dropdown = document.querySelector('.dropdown'); // Select the original dropdown
  const dropdownLinks = dropdown.querySelectorAll('.dropdown-menu a');
  const sectionNameDisplay = document.getElementById('section-name-display');
  const isMobile = window.innerWidth <= 768;
  const allImages = document.querySelectorAll('.image-placeholder img');
  
  // Force image resize on mobile
  if (isMobile && allImages.length) {
    allImages.forEach(img => {
      // Ensure images load properly on mobile
      if (img.complete) {
        // Already loaded images
        setOptimalImageSize(img);
      } else {
        // Images that haven't loaded yet
        img.onload = () => setOptimalImageSize(img);
      }
    });
  }
  
  // Helper function for sizing images
  function setOptimalImageSize(img) {
    const containerWidth = img.parentElement.clientWidth * 0.9; // 90% of container
    const containerHeight = Math.min(window.innerHeight * 0.7, 500); // 70% of viewport height, max 500px
    
    img.style.maxWidth = `${containerWidth}px`;
    img.style.maxHeight = `${containerHeight}px`;
  }

  // --- Site Title Hover Effect ---
  if (siteTitle) {
    const originalTitle = siteTitle.textContent;
    const translations = [
      "مازیار معینی فیض‌آبادی",       // Farsi  
      "Мазеяр Моейни Фейзабади",      // Russian
      "Μαζεγιάρ Μοεϊνί Φεϊζαμπαντί", // Greek
      "马泽亚尔·穆伊尼·费扎巴迪",      // Chinese
      "मज़ेयार मोएनी फ़ेज़ाबादी",      // Hindi
      "Mazeyar Moeini Feizabadi"      // English
    ];
    let currentIndex = 0;

    siteTitle.addEventListener('mouseover', () => {
      const cycleTranslations = () => {
        siteTitle.textContent = translations[currentIndex];
        currentIndex = (currentIndex + 1) % translations.length;
      };
      
      // Start cycling immediately
      cycleTranslations();
      
      // Set up the interval for subsequent transitions
      const interval = setInterval(() => {
        cycleTranslations();
      }, 750);
      
      // Store interval ID to clear it later
      siteTitle.dataset.intervalId = interval;
    });

    siteTitle.addEventListener('mouseout', () => {
      // Clear the interval when mouse leaves
      if (siteTitle.dataset.intervalId) {
        clearInterval(parseInt(siteTitle.dataset.intervalId));
        delete siteTitle.dataset.intervalId;
      }
      // Reset to original title
      siteTitle.textContent = originalTitle;
      currentIndex = 0;
    });
  }

  // --- Coordinates Hover Effect ---
  if (coordinatesDisplay) {
      const originalCoordinates = coordinatesDisplay.textContent;
      const hoverText = "I currently reside in Bologna, Italy and have lived in five other countries.";
      const isMobile = window.innerWidth <= 840;

      if (!isMobile) {
          coordinatesDisplay.addEventListener('mouseover', () => {
              coordinatesDisplay.textContent = hoverText;
          });

          coordinatesDisplay.addEventListener('mouseout', () => {
              coordinatesDisplay.textContent = originalCoordinates;
          });
      } else {
          coordinatesDisplay.textContent = "📍🇮🇹";
      }
  }

  // --- Dropdown Hover (for Section Name Display) ---
  // Blur is handled by CSS: .dropdown:hover ~ main
  if (dropdown) {
      // Section Name Display on Dropdown Link Hover
      dropdownLinks.forEach(link => {
        link.addEventListener('mouseover', () => {
          const sectionName = link.getAttribute('data-section-name');
          if (sectionName && sectionNameDisplay) {
            sectionNameDisplay.textContent = sectionName;
            sectionNameDisplay.style.opacity = '1';
          }
        });
      });

      // Hide section name when mouse leaves dropdown area
      dropdown.addEventListener('mouseleave', () => {
           if (sectionNameDisplay) {
             sectionNameDisplay.style.opacity = '0';
           }
      });
  }


  // --- Scrollspy Logic ---
  const sections = document.querySelectorAll('main section');
  const menuNumberSpans = dropdown.querySelectorAll('.dropdown-menu a .section-number'); // Target spans in original dropdown

  const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5
  };

  let currentActiveSectionId = null;

  const observer = new IntersectionObserver((entries) => {
       let bestIntersectingEntry = null;
       entries.forEach(entry => {
           if (entry.isIntersecting) {
               bestIntersectingEntry = entry;
           }
       });

      const newActiveSectionId = bestIntersectingEntry ? bestIntersectingEntry.target.getAttribute('id') : null;

      if (newActiveSectionId !== currentActiveSectionId) {
          currentActiveSectionId = newActiveSectionId;

          menuNumberSpans.forEach(span => {
              const linkHref = span.closest('a').getAttribute('href');
              const linkSectionId = linkHref ? linkHref.substring(1) : null;

              if (linkSectionId && linkSectionId === currentActiveSectionId) {
                  span.classList.add('active-section');
              } else {
                  span.classList.remove('active-section');
              }
          });
      }

  }, observerOptions);

  sections.forEach(section => {
      observer.observe(section);
  });
}); 