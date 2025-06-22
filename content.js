const MAX_RETRIES = 20;
let retryCount = 0;
let observer = null;
let isInitializing = false;
let isAddingTranscriptButton = false;

// Main initialization with proper locking
function initializeExtension() {
  if (isInitializing) return;
  isInitializing = true;
  
  try {
    // Clean up previous observers
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    // Try to add both buttons immediately
    addShowTranscriptButton();
    setupTranscriptObserver();

  } catch (error) {
    console.error('Initialization error:', error);
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(initializeExtension, 500 + (retryCount * 200));
    }
  } finally {
    isInitializing = false;
  }
}

// Improved show transcript button with click tracking
function addShowTranscriptButton() {
  if (isAddingTranscriptButton) return;
  isAddingTranscriptButton = true;

  try {
    const existingShowBtn = document.querySelector('.yt-show-transcript-btn');
    if (existingShowBtn) {
      return;
    }

    const containers = [
      '#top-level-buttons-computed',
      '#menu-container .top-level-buttons',
      '#actions-inner.ytd-watch-metadata',
      '.ytd-video-primary-info-renderer .yt-spec-button-shape-next'
    ];

    for (const selector of containers) {
      const buttonsContainer = document.querySelector(selector);
      if (buttonsContainer) {
        const showBtn = document.createElement('button');
        showBtn.className = 'yt-show-transcript-btn style-scope ytd-button-renderer';
        showBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <span>Show Transcript</span>
        `;
        
        showBtn.addEventListener('click', async function handleClick() {
			
		  showBtn.classList.add('clicked');
		  setTimeout(() => showBtn.classList.remove('clicked'), 300);
		  
          // Disable the button during processing
          showBtn.disabled = true;
          
          try {
            const nativeButtons = [
              'button[aria-label*="transcript" i]',
              '#primary-button button',
              '.ytp-button.ytp-transcript',
              'tp-yt-paper-button[aria-label*="transcript" i]'
            ];
            
            for (const btnSelector of nativeButtons) {
              const nativeBtn = document.querySelector(btnSelector);
              if (nativeBtn) {
                nativeBtn.click();
                await new Promise(resolve => setTimeout(resolve, 1500));
                
                // Check if transcript opened successfully
                if (document.querySelector('ytd-transcript-renderer, ytd-engagement-panel-transcript-renderer')) {
                  break;
                }
              }
            }
          } catch (error) {
            console.error('Transcript open error:', error);
          } finally {
            showBtn.disabled = false;
          }
        });
        
        if (buttonsContainer.children.length > 0) {
          buttonsContainer.insertBefore(showBtn, buttonsContainer.lastChild);
        } else {
          buttonsContainer.appendChild(showBtn);
        }
        
        return;
      }
    }
  } finally {
    isAddingTranscriptButton = false;
  }
}

// Optimized transcript panel detection
function checkForTranscriptPanel() {
  const transcriptContainers = [
    'ytd-transcript-renderer',
    'ytd-engagement-panel-transcript-renderer',
    '#engagement-panel-transcript'
  ];

  for (const selector of transcriptContainers) {
    const container = document.querySelector(selector);
    if (container && !container.querySelector('.yt-copy-transcript-btn')) {
      addCopyButtonToTranscript(container);
      return;
    }
  }
}

// Efficient observer setup
function setupTranscriptObserver() {
  observer = new MutationObserver((mutations) => {
    if (!document.querySelector('.yt-show-transcript-btn')) {
      addShowTranscriptButton();
    }
    
    checkForTranscriptPanel();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
}

// Safe copy button addition
function addCopyButtonToTranscript(container) {
  const existingCopyBtn = container.querySelector('.yt-copy-transcript-btn');
  if (existingCopyBtn) return;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'yt-copy-transcript-btn style-scope ytd-button-renderer';
  copyBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
    </svg>
    <span>Copy Transcript</span>
  `;
  
  copyBtn.addEventListener('click', async () => {
    try {
	  // Add click animation
	  copyBtn.classList.add('clicked');
	  setTimeout(() => copyBtn.classList.remove('clicked'), 300);
      copyBtn.disabled = true;
      
      const transcriptSelectors = [
        'ytd-transcript-body-renderer',
        'ytd-transcript-segment-list-renderer',
        '.segment-list',
        '#segments-container'
      ];
      
      let transcriptContainer = null;
      for (const selector of transcriptSelectors) {
        transcriptContainer = document.querySelector(selector);
        if (transcriptContainer) break;
      }
      
      if (!transcriptContainer) throw new Error('Transcript container not found');

      // Get all segments and process them
      const segments = transcriptContainer.querySelectorAll('ytd-transcript-segment-renderer, [role="listitem"], .segment');
      if (segments.length === 0) throw new Error('No segments found');

      // Process text segments while:
      // 1. Removing timestamps
      // 2. Removing duplicate lines
      // 3. Creating proper paragraphs
      let previousText = '';
      const fullText = Array.from(segments)
        .map(segment => {
          // Get only the text content (ignore timestamp elements)
          const textElement = segment.querySelector('.segment-text, [role="text"], .text');
          return textElement ? textElement.textContent.trim() : '';
        })
        .filter(text => {
          // Filter out empty text and duplicates
          if (!text || text === previousText) {
            return false;
          }
          previousText = text;
          return true;
        })
        .join(' ') // Join with spaces for natural reading
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .replace(/([,.!?])([^ ])/g, '$1 $2') // Add space after punctuation if missing
        .replace(/\bi\b/g, 'I'); // Fix lowercase "i"

      await navigator.clipboard.writeText(fullText);
      showButtonFeedback(copyBtn, 'Copied!', '#0a8043');
	 	
	  // Add success animation after successful copy
	  copyBtn.classList.add('success');
	  setTimeout(() => copyBtn.classList.remove('success'), 600);
	  
    } catch (error) {
      console.error('Copy failed:', error);
      showButtonFeedback(copyBtn, 'Error!', '#d93025');
    } finally {
      copyBtn.disabled = false;
    }
  });

	// For the copy button
	copyBtn.addEventListener('click', async () => {
	  try {
		
		copyBtn.disabled = true;
		
		// ... your existing copy logic ...
		
	  } catch (error) {
		// ... error handling ...
	  } finally {
		copyBtn.disabled = false;
	  }
	});

  const header = container.querySelector('#header, .header, .panel-header');
  if (header) {
    header.appendChild(copyBtn);
  } else {
    container.insertBefore(copyBtn, container.firstChild);
  }
}

function showButtonFeedback(button, text, color) {
  const span = button.querySelector('span');
  const originalText = span.textContent;
  const originalColor = button.style.backgroundColor;
  
  span.textContent = text;
  button.style.backgroundColor = color;
  
  setTimeout(() => {
    span.textContent = originalText;
    button.style.backgroundColor = originalColor;
  }, 2000);
}

// Event listeners with proper debouncing
let navigationTimer = null;
function handleNavigation() {
  clearTimeout(navigationTimer);
  navigationTimer = setTimeout(() => {
    retryCount = 0;
    initializeExtension();
  }, 500);
}

document.addEventListener('yt-navigate-finish', handleNavigation);
document.addEventListener('yt-page-data-updated', handleNavigation);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  setTimeout(initializeExtension, 1000);
}

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
  }
});