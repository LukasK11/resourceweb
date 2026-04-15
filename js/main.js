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
      if (typeof clearMobileMarquee === 'function') clearMobileMarquee();

      var group = btn.closest('.button-group');
      var isAllBtn = btn.classList.contains('all-btn');
      var allBtn = group ? group.querySelector('.all-btn') : null;

      if (isAllBtn) {
        // Clicking "all": deselect all other filters in this group, select "all"
        if (group) {
          group.querySelectorAll('.toggle-btn:not(.all-btn)').forEach(b => b.classList.remove('active'));
        }
        btn.classList.add('active');
      } else {
        // Toggle this filter
        btn.classList.toggle('active');
        // If any non-all filter is now active, deselect "all"
        var hasActive = group && group.querySelector('.toggle-btn.active:not(.all-btn)');
        if (allBtn) {
          if (hasActive) {
            allBtn.classList.remove('active');
          } else {
            // No filters active in this group, re-select "all"
            allBtn.classList.add('active');
          }
        }
      }

      // Get all active non-all filters
      var activeBtns = Array.from(document.querySelectorAll('.toggle-btn.active:not(.all-btn)'));
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

  // Calculate left edge: follow mouse but clamp to right of last visible text column
  const firstRow = document.querySelector('.list > .row');
  let minLeftX = 0;
  if (firstRow) {
    const neighbourhood = firstRow.querySelector('.neighbourhood');
    const studio = firstRow.querySelector('.studio');
    // Use neighbourhood if visible, otherwise fall back to studio
    const anchor = (neighbourhood && neighbourhood.offsetWidth > 0) ? neighbourhood
                 : (studio && studio.offsetWidth > 0) ? studio
                 : null;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      minLeftX = rect.right + 10;
    }
  }
  const leftX = Math.max(mouseX + 20, minLeftX);

  // Clamp so the bottom of the preview never goes below the top of the footer
  const maxTop = bottomTop - previewHeight;
  const clampedY = Math.min(mouseY, maxTop);

  hoverPreview.style.left = leftX + 'px';
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

function populateGallery(gallery, folder, colourFiles, title, row) {
  gallery.innerHTML = '';
  if (!colourFiles || colourFiles.length === 0) return;

  // Add close (X) button before images, hidden off-screen to the left
  const closeBtn = document.createElement('div');
  closeBtn.className = 'gallery-close';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof collapseRow === 'function') collapseRow();
  });
  gallery.appendChild(closeBtn);

  colourFiles.forEach((filename, i) => {
    const img = document.createElement('img');
    const colourFolder = row.dataset.colourFolder || 'colour';
    img.src = `./images/${encodeURIComponent(folder)}/${colourFolder}/${encodeURIComponent(filename)}`;
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

  // Track whether the endzone tooltip is already showing (for mobile two-tap)
  let endzonePrimed = false;

  // Click endzone to open external link in new tab
  endzone.style.cursor = 'pointer';
  endzone.addEventListener('click', (e) => {
    e.stopPropagation();
    const row = gallery.closest('.row');
    const url = row ? row.getAttribute('data-link') : null;

    if (isMobileView()) {
      if (!endzonePrimed) {
        // First tap: show tooltip + visual effects (same as desktop hover)
        gallery.classList.add('endzone-hover');
        arrow.classList.add('show-tail');
        // Position tooltip fixed below the arrowhead
        const arrowRect = arrow.getBoundingClientRect();
        tooltip.style.left = (arrowRect.right - 10) + 'px';
        tooltip.style.top = (arrowRect.top + arrowRect.height / 2 + 20) + 'px';
        tooltip.classList.add('visible');
        endzonePrimed = true;
        return;
      }
      // Second tap: navigate
      endzonePrimed = false;
      if (url) window.open(url, '_blank');
    } else {
      if (url) window.open(url, '_blank');
    }
  });

  // Reset primed state when scrolling away from endzone on mobile
  gallery.addEventListener('scroll', () => {
    if (endzonePrimed) {
      endzonePrimed = false;
      gallery.classList.remove('endzone-hover');
      arrow.classList.remove('show-tail');
      tooltip.classList.remove('visible');
    }
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

  // On mobile, inject a marquee into the text bar showing studio + neighbourhood
  if (isMobileView()) {
    showMobileMarqueeInBar(textBar);
  }

  // Create gallery inside the row
  let gallery = row.querySelector('.row-gallery');
  if (!gallery) {
    gallery = document.createElement('div');
    gallery.className = 'row-gallery';
    row.appendChild(gallery);
  }
  populateGallery(gallery, folder, colourFiles, title, row);

  // Immediately scroll past the close button so it's never visible during open
  const closeBtn = gallery.querySelector('.gallery-close');
  if (closeBtn) {
    gallery.scrollLeft = closeBtn.offsetWidth + 12;
  }

  // Place the row fixed at its CURRENT position first (no visual jump)
  row.style.position = 'fixed';
  row.style.top = startTop + 'px';
  row.style.left = '0';
  row.style.right = '0';
  row.style.height = startHeight + 'px';
  row.classList.add('row-expanded');
  row.offsetHeight; // force reflow

  // Animate top slides up to header, height grows to fill the gap
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
  // Move the text bar and gallery into the overlay so they slide away with it
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

  // Restore Isotope styles (still valid because unbound Isotope resize)
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

  // Animate the overlay shrinking to the row's position — revealing the row underneath
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

// ---- MOBILE MARQUEE ----
let marqueeActiveRow = null; // the row currently showing a marquee

function isMobileView() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function clearMobileMarquee() {
  if (marqueeActiveRow) {
    const existing = marqueeActiveRow.querySelector('.mobile-marquee');
    if (existing) existing.remove();
    marqueeActiveRow.classList.remove('marquee-active');
    marqueeActiveRow = null;
  }
}

function showMobileMarquee(row) {
  // Remove any existing marquee on another row
  clearMobileMarquee();

  const studio = row.querySelector('.studio');
  const neighbourhood = row.querySelector('.neighbourhood');
  const number = row.querySelector('.number');
  const studioText = studio ? studio.textContent.trim() : '';
  const neighbourhoodText = neighbourhood ? neighbourhood.textContent.trim() : '';

  // Build marquee content: "studio  ·  neighbourhood" repeated for seamless loop
  const content = [studioText, neighbourhoodText].filter(Boolean).join('  ·  ');

  const marquee = document.createElement('div');
  marquee.className = 'mobile-marquee';

  const inner = document.createElement('div');
  inner.className = 'mobile-marquee-inner';

  // Two identical copies for seamless infinite loop
  for (let i = 0; i < 2; i++) {
    const span = document.createElement('span');
    span.textContent = content;
    inner.appendChild(span);
  }
  marquee.appendChild(inner);

  // Insert marquee between name and number
  row.insertBefore(marquee, number);
  row.classList.add('marquee-active');
  marqueeActiveRow = row;
}

// Show marquee inside an already-created text bar (used during expand)
function showMobileMarqueeInBar(textBar) {
  const studio = textBar.querySelector('.studio');
  const neighbourhood = textBar.querySelector('.neighbourhood');
  const number = textBar.querySelector('.number');
  const studioText = studio ? studio.textContent.trim() : '';
  const neighbourhoodText = neighbourhood ? neighbourhood.textContent.trim() : '';

  const content = [studioText, neighbourhoodText].filter(Boolean).join('  ·  ');

  const marquee = document.createElement('div');
  marquee.className = 'mobile-marquee';

  const inner = document.createElement('div');
  inner.className = 'mobile-marquee-inner';

  // Two identical copies for seamless infinite loop
  for (let i = 0; i < 2; i++) {
    const span = document.createElement('span');
    span.textContent = content;
    inner.appendChild(span);
  }
  marquee.appendChild(inner);

  // Insert before the number element in the text bar
  if (number) {
    textBar.insertBefore(marquee, number);
  } else {
    textBar.appendChild(marquee);
  }
  textBar.classList.add('marquee-active');
}

// Attach click listeners to rows
document.querySelectorAll('.list > .row').forEach(row => {
  row.addEventListener('click', () => {
    clearMobileMarquee();
    if (isMobileView() && document.querySelector('.buttons-wrapper.filters-open')) {
      // Close filters first, then expand after the transition completes
      closeMobileFilters();
      setTimeout(() => expandRow(row), 420);
    } else {
      expandRow(row);
    }
  });
});

// Close via header (Purple Pages) click
const headerLogotype = document.querySelector('.header-logotype');
if (headerLogotype) {
  headerLogotype.addEventListener('click', () => {
    clearMobileMarquee();
    collapseRow();
  });
}

// Glitch-scramble text effect on header logotype
(function () {
  const el = document.querySelector('.header-logotype');
  if (!el) return;

  const textA = 'PURPLE PAGES';
  const textB = 'AN INDEX OF TORONTO TATTOO ARTISTS';
  const glyphPool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const frameDuration = 30;   // ms per tick
  const totalSteps = 18;      // number of ticks for the full resolve

  let currentText = textA;
  let targetText = textB;
  let animFrame = null;
  let step = 0;

  function randomChar() {
    return glyphPool[Math.floor(Math.random() * glyphPool.length)];
  }

  function scrambleTo(target, onDone) {
    if (animFrame) clearInterval(animFrame);
    targetText = target;
    step = 0;
    const maxLen = Math.max(currentText.length, targetText.length);

    animFrame = setInterval(() => {
      step++;
      let out = '';
      for (let i = 0; i < maxLen; i++) {
        const targetChar = i < targetText.length ? targetText[i] : '';
        // Each character resolves at a staggered point
        const resolveAt = Math.floor((i / maxLen) * totalSteps * 0.6) + totalSteps * 0.4;
        if (step >= resolveAt || targetChar === ' ') {
          out += targetChar;
        } else {
          out += randomChar();
        }
      }
      el.textContent = out;

      if (step >= totalSteps) {
        clearInterval(animFrame);
        animFrame = null;
        el.textContent = targetText;
        currentText = targetText;
        if (onDone) onDone();
      }
    }, frameDuration);
  }

  const header = document.querySelector('.site-header');
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
  let showingB = false;

  // Desktop: hover in/out
  header.addEventListener('mouseenter', () => { if (!isMobile()) scrambleTo(textB); });
  header.addEventListener('mouseleave', () => { if (!isMobile()) scrambleTo(textA); });

  // Mobile: tap to toggle
  header.addEventListener('click', (e) => {
    if (!isMobile()) return;
    // Don't scramble when tapping to close an expanded row
    if (listExpanded) return;
    if (e.target.closest('.header-logotype') || e.target === header) {
      showingB = !showingB;
      scrambleTo(showingB ? textB : textA);
    }
  });
})();



// Update expanded height on resize
window.addEventListener('resize', () => {
  if (listExpanded && expandedRow) {
    expandedRow.style.height = getTargetHeight() + 'px';
  }
  updateListPadding();
});

// Dynamically set list bottom padding to match the fixed bottom container
function updateListPadding() {
  const list = document.querySelector('.list');
  const bottom = document.querySelector('.bottom-container');
  if (!list || !bottom) return;
  const h = bottom.getBoundingClientRect().height;
  list.style.paddingBottom = (h + 8) + 'px';
}
updateListPadding();
window.addEventListener('load', updateListPadding);

// Dismiss mobile marquee when tapping outside of rows
document.addEventListener('click', (e) => {
  if (!marqueeActiveRow) return;
  if (e.target.closest('.list > .row')) return;
  clearMobileMarquee();
});

// ---- MOBILE FILTER TOGGLE ----
(function () {
  const toggleBtn = document.querySelector('.mobile-filter-toggle');
  const wrapper = document.querySelector('.buttons-wrapper');
  if (!toggleBtn || !wrapper) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = wrapper.classList.toggle('filters-open');
    toggleBtn.classList.toggle('open', isOpen);
    // Update list padding after the transition finishes
    setTimeout(updateListPadding, 420);
    requestAnimationFrame(updateListPadding);
  });
})();

// Close the mobile filter panel programmatically
function closeMobileFilters() {
  const toggleBtn = document.querySelector('.mobile-filter-toggle');
  const wrapper = document.querySelector('.buttons-wrapper');
  if (!toggleBtn || !wrapper) return;
  if (wrapper.classList.contains('filters-open')) {
    wrapper.classList.remove('filters-open');
    toggleBtn.classList.remove('open');
    setTimeout(updateListPadding, 420);
    requestAnimationFrame(updateListPadding);
  }
}
