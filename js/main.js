// Toggle button functionality handled by Isotope filter logic below
// Isotope filtering logic
document.addEventListener('DOMContentLoaded', function() {
  var listElem = document.querySelector('.list');
  if (!listElem) return;
  window.iso = new Isotope(listElem, {
    itemSelector: '.row',
    layoutMode: 'vertical',
    transitionDuration: '0.6s',
    hiddenStyle: {
      opacity: 0,
      transform: 'translateX(100vw)'
    },
    visibleStyle: {
      opacity: 1
    }
  });

  // Add filter functionality
  var noResults = listElem.querySelector('.no-results');
  function updateNoResults() {
    var visibleItems = window.iso.filteredItems.length;
    if (visibleItems === 0) {
      listElem.classList.add('show-no-results');
    } else {
      listElem.classList.remove('show-no-results');
    }
  }

  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      // Close any open dropdown before filtering
      if (typeof collapseRowInstant === 'function') collapseRowInstant();

      // Toggle active state
      btn.classList.toggle('active');
      // Get all active filters
      var activeBtns = Array.from(document.querySelectorAll('.toggle-btn.active'));
      var filters = activeBtns.map(b => b.textContent.toLowerCase());
      // If no filters, show all
      if (filters.length === 0) {
        window.iso.arrange({ filter: '*' });
        updateNoResults();
        return;
      }
      // Filter rows based on data-style or data-content attributes (AND logic)
      window.iso.arrange({
        filter: function(itemElem) {
          var style = itemElem.getAttribute('data-style') || '';
          var content = itemElem.getAttribute('data-content') || '';
          var allTags = (style + ' ' + content).toLowerCase().split(/\s+/).filter(Boolean);
          // Require all filters to be present
          return filters.every(f => allTags.includes(f));
        }
      });
      updateNoResults();
    });
  });
});

// Hover image preview functionality
const hoverPreview = document.getElementById('hover-preview');
const hoverImage = document.getElementById('hover-image');
let currentInterval = null;
let currentImageIndex = 1;
let mouseX = 0;
let mouseY = 0;
let listExpanded = false;
let expandedFor = null;

// Update preview position to follow mouse
function updatePreviewPosition() {
  const bottomContainer = document.querySelector('.bottom-container');
  const bottomTop = bottomContainer ? bottomContainer.getBoundingClientRect().top : window.innerHeight;
  const previewHeight = hoverPreview.offsetHeight || 0;

  // Clamp so the bottom of the preview never goes below the top of the footer
  const maxTop = bottomTop - previewHeight;
  const clampedY = Math.min(mouseY, maxTop);

  hoverPreview.style.left = (mouseX + 20) + 'px';
  hoverPreview.style.top = clampedY + 'px';
}

// Start cycling through images
function startImageCycle(folder, totalImages) {
  if (totalImages <= 0) return;
  if (listExpanded) return;

  currentImageIndex = 1;
  hoverImage.src = `images/${folder}/${folder}_purple${currentImageIndex}.png`;
  hoverPreview.style.display = 'block';
  
  currentInterval = setInterval(() => {
    currentImageIndex++;
    if (currentImageIndex > totalImages) {
      currentImageIndex = 1;
    }
    hoverImage.src = `images/${folder}/${folder}_purple${currentImageIndex}.png`;
  }, 600);
}

// Stop cycling
function stopImageCycle() {
  if (currentInterval) {
    clearInterval(currentInterval);
    currentInterval = null;
  }
  hoverPreview.style.display = 'none';
}

// Add event listeners to rows
document.querySelectorAll('.list > .row').forEach(row => {
  const folder = row.dataset.folder;
  const totalImages = parseInt(row.dataset.images, 10);

  row.addEventListener('mouseenter', () => {
    startImageCycle(folder, totalImages);
  });

  row.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    updatePreviewPosition();
  });

  row.addEventListener('mouseleave', () => {
    stopImageCycle();
  });
});

// Row expansion logic — the clicked row expands to fill the area
let expandedRow = null;
let expandedPlaceholder = null; // holds the row's place in the list
let expandedNextSibling = null; // the element that was after the row
let expandedParent = null;      // the .list container
let savedIsotopeStyles = null;  // original inline styles set by Isotope
let savedRowHTML = '';           // original innerHTML of the row
let galleryWheelHandler = null; // wheel handler for gallery scroll

// Convert vertical scroll into horizontal scroll for the gallery
function initGalleryScroll(row) {
  const gallery = row.querySelector('.row-gallery');
  if (!gallery) return;

  galleryWheelHandler = function(e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      gallery.scrollLeft += e.deltaY;
    }
  };

  gallery.addEventListener('wheel', galleryWheelHandler, { passive: false });
}

function cleanupGalleryScroll() {
  if (expandedRow && galleryWheelHandler) {
    const gallery = expandedRow.querySelector('.row-gallery');
    if (gallery) gallery.removeEventListener('wheel', galleryWheelHandler);
    galleryWheelHandler = null;
  }
}

function populateGallery(gallery, folder, colourFiles, title) {
  gallery.innerHTML = '';
  if (!colourFiles || colourFiles.length === 0) return;
  colourFiles.forEach((filename, i) => {
    const img = document.createElement('img');
    img.src = `./images/${encodeURIComponent(folder)}/colour/${encodeURIComponent(filename)}`;
    img.alt = `${title} ${i + 1}`;
    img.loading = 'lazy';
    gallery.appendChild(img);
  });

  // Add end zone spacer
  const endzone = document.createElement('div');
  endzone.className = 'gallery-endzone';
  gallery.appendChild(endzone);

  // Add arrow inside endzone so it scrolls with gallery content
  const arrow = document.createElement('div');
  arrow.className = 'gallery-arrow';
  endzone.appendChild(arrow);

  // Create cursor-follow tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'endzone-tooltip';
  tooltip.innerHTML = '<span>visit</span><span>' + title.toLowerCase() + '</span>';
  document.body.appendChild(tooltip);

  // Dim images and show full arrow tail when hovering the end zone
  endzone.addEventListener('mouseenter', () => {
    gallery.classList.add('endzone-hover');
    arrow.classList.add('show-tail');
    tooltip.classList.add('visible');
  });
  endzone.addEventListener('mouseleave', () => {
    gallery.classList.remove('endzone-hover');
    arrow.classList.remove('show-tail');
    tooltip.classList.remove('visible');
  });
  endzone.addEventListener('mousemove', (e) => {
    tooltip.style.left = e.clientX + 'px';
    tooltip.style.top = e.clientY + 21 + 'px';
  });

  // Click endzone to open external link in new tab
  endzone.style.cursor = 'pointer';
  endzone.addEventListener('click', (e) => {
    e.stopPropagation();
    const row = gallery.closest('.row');
    const url = row ? row.getAttribute('data-link') : null;
    if (url) window.open(url, '_blank');
  });
}

function getTargetHeight() {
  const bottomContainer = document.querySelector('.bottom-container');
  const bottomH = bottomContainer ? bottomContainer.getBoundingClientRect().height : 80;
  return window.innerHeight - 36 - bottomH;
}

function expandRow(row) {
  const folder = row.dataset.folder;
  const totalImages = parseInt(row.dataset.images, 10) || 0;
  const title = row.querySelector('.name') ? row.querySelector('.name').textContent : folder;

  // If same row clicked, collapse
  if (listExpanded && expandedRow === row) {
    collapseRow();
    return;
  }

  // If different row is expanded, collapse it first (instant), then expand new one
  if (listExpanded && expandedRow) {
    collapseRowInstant();
  }

  // Parse colour image filenames from data attribute
  const colourAttr = row.getAttribute('data-colour') || '';
  const colourFiles = colourAttr ? colourAttr.split(',').map(f => f.trim()).filter(Boolean) : [];
  if (colourFiles.length === 0) return;

  // Capture where the row currently sits on screen
  const rect = row.getBoundingClientRect();
  const startTop = rect.top;
  const startHeight = rect.height;

  // Remember where the row lives in the DOM so we can put it back
  expandedParent = row.parentElement;
  expandedNextSibling = row.nextSibling;

  // Save Isotope's inline styles so we can restore them on collapse
  savedIsotopeStyles = {
    position: row.style.position,
    top: row.style.top,
    left: row.style.left,
    right: row.style.right,
    transform: row.style.transform,
    height: row.style.height,
  };

  // Insert a hidden placeholder to keep Isotope's layout stable
  expandedPlaceholder = document.createElement('div');
  expandedPlaceholder.className = 'row-placeholder';
  expandedPlaceholder.style.height = startHeight + 'px';
  expandedParent.insertBefore(expandedPlaceholder, expandedNextSibling);

  // Save the original row content before modifying it
  savedRowHTML = row.innerHTML;

  // Move the row to body so it escapes any transform context
  document.body.appendChild(row);

  // Wrap the text spans into a bar so the gallery flows below
  let textBar = row.querySelector('.row-text-bar');
  if (!textBar) {
    textBar = document.createElement('div');
    textBar.className = 'row-text-bar';
    while (row.firstElementChild) {
      textBar.appendChild(row.firstElementChild);
    }
    row.appendChild(textBar);
  }

  // Create gallery inside the row
  let gallery = row.querySelector('.row-gallery');
  if (!gallery) {
    gallery = document.createElement('div');
    gallery.className = 'row-gallery';
    row.appendChild(gallery);
  }
  populateGallery(gallery, folder, colourFiles, title);

  // Place the row fixed at its CURRENT position first (no visual jump)
  row.style.position = 'fixed';
  row.style.top = startTop + 'px';
  row.style.left = '0';
  row.style.right = '0';
  row.style.height = startHeight + 'px';
  row.classList.add('row-expanded');
  row.offsetHeight; // force reflow

  // Now animate: top slides up to header, height grows to fill the gap
  const bottomContainer = document.querySelector('.bottom-container');
  const bottomH = bottomContainer ? bottomContainer.getBoundingClientRect().height : 80;
  const endTop = 36; // just below the header
  const endHeight = window.innerHeight - 36 - bottomH;

  row.style.top = endTop + 'px';
  row.style.height = endHeight + 'px';

  // After transition, allow scrolling and set up wheel-based horizontal scroll
  function onDone(e) {
    if (e.propertyName !== 'height' && e.propertyName !== 'top') return;
    row.removeEventListener('transitionend', onDone);
    row.classList.add('row-open');
    initGalleryScroll(row);
  }
  row.addEventListener('transitionend', onDone);

  expandedRow = row;
  listExpanded = true;
  expandedFor = folder;
  document.body.classList.add('dropdown-open');
  stopImageCycle();

  // Prevent Isotope from re-laying out while the dropdown is open
  if (window.iso) window.iso.unbindResize();
}

function collapseRow() {
  if (!expandedRow) return;
  const row = expandedRow;

  cleanupGalleryScroll();
  row.classList.remove('row-open');

  // Create an overlay that looks exactly like the current expanded state
  // Move the text bar and gallery INTO the overlay so they slide away with it
  const overlay = document.createElement('div');
  overlay.className = 'collapse-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = row.style.top;       // currently at 36px (header bottom)
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.height = row.style.height;  // current expanded height
  overlay.style.background = 'white';
  overlay.style.zIndex = '1500';
  overlay.style.overflow = 'hidden';
  overlay.style.display = 'block';
  overlay.style.padding = '0';
  overlay.style.margin = '0';
  overlay.style.boxSizing = 'border-box';
  overlay.style.transition = 'top 0.5s ease-in-out, height 0.5s ease-in-out';

  // Move the text bar (with the text) and gallery into the overlay
  const textBar = row.querySelector('.row-text-bar');
  const gallery = row.querySelector('.row-gallery');
  if (textBar) overlay.appendChild(textBar);
  if (gallery) overlay.appendChild(gallery);

  document.body.appendChild(overlay);

  // Remove any endzone tooltips
  document.querySelectorAll('.endzone-tooltip').forEach(t => t.remove());

  // Restore the row's original HTML content
  row.innerHTML = savedRowHTML;
  savedRowHTML = '';

  // Immediately put the row back in the list in its original position
  // Disable transitions so nothing animates
  row.style.transition = 'none';

  row.classList.remove('row-expanded');
  row.style.height = '';
  row.style.top = '';
  row.style.position = '';
  row.style.left = '';
  row.style.right = '';

  // Move row back into the list
  if (expandedPlaceholder && expandedPlaceholder.parentElement) {
    expandedParent.insertBefore(row, expandedPlaceholder);
    expandedPlaceholder.remove();
  }

  // Restore Isotope styles (still valid because we unbound Isotope resize)
  if (savedIsotopeStyles) {
    row.style.position = savedIsotopeStyles.position;
    row.style.top = savedIsotopeStyles.top;
    row.style.left = savedIsotopeStyles.left;
    row.style.right = savedIsotopeStyles.right;
    row.style.transform = savedIsotopeStyles.transform;
    row.style.height = savedIsotopeStyles.height;
    savedIsotopeStyles = null;
  }

  row.offsetHeight; // reflow
  row.style.transition = '';

  expandedPlaceholder = null;
  expandedNextSibling = null;
  expandedParent = null;
  expandedRow = null;
  listExpanded = false;
  expandedFor = null;
  document.body.classList.remove('dropdown-open');

  // Re-enable Isotope resize binding
  if (window.iso) window.iso.bindResize();

  // Get the row's actual position for overlay target
  const returnTop = row.getBoundingClientRect().top;

  // Slide gallery images off to the right
  const overlayGallery = overlay.querySelector('.row-gallery');
  if (overlayGallery) {
    overlayGallery.style.transform = 'translateX(100vw)';
  }

  // Now animate the overlay shrinking to the row's position — revealing the row underneath
  // Clamp top so the overlay never goes above the header (36px)
  overlay.offsetHeight; // reflow
  overlay.style.top = Math.max(36, returnTop) + 'px';
  overlay.style.height = '36px';

  function onOverlayDone(e) {
    if (e.propertyName !== 'height' && e.propertyName !== 'top') return;
    overlay.removeEventListener('transitionend', onOverlayDone);
    overlay.remove();
  }
  overlay.addEventListener('transitionend', onOverlayDone);
}

function collapseRowInstant() {
  if (!expandedRow) return;
  const row = expandedRow;
  cleanupGalleryScroll();
  row.classList.remove('row-open', 'row-expanded');
  row.style.height = '';
  row.style.top = '';
  row.style.position = '';
  row.style.left = '';
  row.style.right = '';
  // Restore original row content
  document.querySelectorAll('.endzone-tooltip').forEach(t => t.remove());
  row.innerHTML = savedRowHTML;
  savedRowHTML = '';
  // Move row back into the list
  if (expandedPlaceholder && expandedPlaceholder.parentElement) {
    expandedParent.insertBefore(row, expandedPlaceholder);
    expandedPlaceholder.remove();
  }
  // Restore the original Isotope inline styles
  if (savedIsotopeStyles) {
    row.style.position = savedIsotopeStyles.position;
    row.style.top = savedIsotopeStyles.top;
    row.style.left = savedIsotopeStyles.left;
    row.style.right = savedIsotopeStyles.right;
    row.style.transform = savedIsotopeStyles.transform;
    row.style.height = savedIsotopeStyles.height;
    savedIsotopeStyles = null;
  }
  expandedPlaceholder = null;
  expandedNextSibling = null;
  expandedParent = null;
  expandedRow = null;
  listExpanded = false;
  expandedFor = null;
  document.body.classList.remove('dropdown-open');

  // Re-enable Isotope resize binding
  if (window.iso) window.iso.bindResize();
}

// Attach click listeners to rows
document.querySelectorAll('.list > .row').forEach(row => {
  row.addEventListener('click', () => {
    expandRow(row);
  });
});

// Close via header (Purple Pages) click
const headerLogotype = document.querySelector('.header-logotype');
if (headerLogotype) {
  headerLogotype.addEventListener('click', collapseRow);
}

// Header marquee scroll on hover
(function() {
  const header = document.querySelector('.site-header');
  const marquee = document.querySelector('.header-marquee');
  if (!header || !marquee) return;

  header.addEventListener('mouseenter', () => {
    marquee.classList.remove('returning');
    marquee.offsetHeight;
    marquee.classList.add('scrolling');
  });

  header.addEventListener('mouseleave', () => {
    marquee.classList.remove('scrolling');
    // Capture current position so return starts from where it is
    const computed = getComputedStyle(marquee).transform;
    marquee.style.transform = computed;
    marquee.offsetHeight; // reflow
    marquee.classList.add('returning');
    // returning class sets transform: translateX(100%) which slides it back off-screen right

    function onDone() {
      marquee.removeEventListener('transitionend', onDone);
      marquee.classList.remove('returning');
      marquee.style.transform = '';
    }
    marquee.addEventListener('transitionend', onDone);
  });
})();

// Update expanded height on resize
window.addEventListener('resize', () => {
  if (listExpanded && expandedRow) {
    expandedRow.style.height = getTargetHeight() + 'px';
  }
});
