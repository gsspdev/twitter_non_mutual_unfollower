(() => {
  const $followButtons = '[data-testid$="-unfollow"]';
  const $confirmButton = '[data-testid="confirmationSheetConfirm"]';
  const $userCell = '[data-testid="UserCell"]';
  const $followIndicator = '[data-testid="userFollowIndicator"]';

  const state = {
    retry: {
      count: 0,
      limit: 3,
    },
    totalUnfollowed: 0,
    consecutiveErrors: 0,
    baseDelay: { min: 2, max: 4 }, // Reasonable 2-4 second base delay
    nextBreakAt: 10 + Math.floor(Math.random() * 16), // Random between 10-25
  };

  // Scroll down just a small amount
  const scrollSmallAmount = () => {
    const scrollAmount = window.innerHeight * 0.5; // Scroll half a viewport height
    window.scrollBy({
      top: scrollAmount,
      behavior: 'smooth'
    });
  };

  const retryLimitReached = () => state.retry.count === state.retry.limit;
  const addNewRetry = () => state.retry.count++;

  // Simple mouse simulation
  const simulateMouseEvents = async (element) => {
    if (!element) return;
    
    // Dispatch mouse enter and over events
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
  };

  // Click with slight position variance
  const humanClick = (element) => {
    if (!element) return;
    
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.3;
    const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * rect.height * 0.3;
    
    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    }));
  };

  // Simple adaptive delay that only increases with errors
  const getAdaptiveDelay = () => {
    const errorMultiplier = Math.max(1, state.consecutiveErrors * 0.5);
    return {
      min: state.baseDelay.min * errorMultiplier,
      max: state.baseDelay.max * errorMultiplier
    };
  };

  const randomSleep = (customDelay = null) => {
    const delay = customDelay || getAdaptiveDelay();
    const seconds = Math.random() * (delay.max - delay.min) + delay.min;
    return new Promise((proceed) => {
      console.log(`Waiting ${seconds.toFixed(2)}s...`);
      setTimeout(proceed, seconds * 1000);
    });
  };

  const waitForElement = (selector, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(interval);
          resolve(el);
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }
      }, 100);
    });
  };

  const checkForRateLimitModal = () => {
    const modal = document.querySelector('[role="dialog"]');
    if (modal && modal.textContent.toLowerCase().includes('limit')) {
      return true;
    }
    return false;
  };

  const unfollowUser = async (followButton) => {
    try {
      // Simple scroll into view
      followButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await randomSleep({ min: 0.5, max: 1 });
      
      // Simulate mouse hover before clicking
      await simulateMouseEvents(followButton);
      
      // Click unfollow with position variance
      humanClick(followButton);
      
      // Wait for confirmation button
      let confirmButton = null;
      
      // Try direct selector first
      try {
        confirmButton = await waitForElement($confirmButton, 3000);
      } catch (e) {
        // Fallback: look in dialogs
        const dialogs = document.querySelectorAll('[role="dialog"], [data-testid="sheetDialog"]');
        for (const dialog of dialogs) {
          confirmButton = dialog.querySelector($confirmButton);
          if (confirmButton) break;
        }
      }

      if (confirmButton && confirmButton.offsetParent !== null) {
        await randomSleep({ min: 0.3, max: 0.6 });
        
        // Mouse events before confirming
        await simulateMouseEvents(confirmButton);
        humanClick(confirmButton);
        
        state.consecutiveErrors = 0; // Reset on success
        return true;
      } else {
        throw new Error('Confirmation button not found');
      }
    } catch (error) {
      state.consecutiveErrors++;
      console.warn('Error unfollowing:', error.message);
      
      // Try to close any open dialogs
      const closeButtons = document.querySelectorAll('[aria-label="Close"], [data-testid="sheetDialogClose"]');
      closeButtons.forEach(btn => btn.click());
      
      return false;
    }
  };

  const unfollowNonFollowers = async (followButtons) => {
    console.log(`Found ${followButtons.length} potential users to check`);
    let unfollowedCount = 0;

    for (let i = 0; i < followButtons.length; i++) {
      // Check for rate limiting
      if (checkForRateLimitModal()) {
        console.warn('Rate limit detected! Waiting 60 seconds...');
        await randomSleep({ min: 60, max: 90 });
      }

      // Take a break at the randomized interval
      if (state.totalUnfollowed >= state.nextBreakAt) {
        console.log(`Taking a break after ${state.totalUnfollowed} unfollows...`);
        await randomSleep({ min: 7, max: 14 });
        // Set next break to be 10-25 unfollows from now
        state.nextBreakAt = state.totalUnfollowed + 10 + Math.floor(Math.random() * 16);
        console.log(`Next break at ${state.nextBreakAt} unfollows`);
      }

      const followButton = followButtons[i];
      
      // Check if button still exists
      if (!document.body.contains(followButton)) {
        continue;
      }

      const userCell = followButton.closest($userCell);
      if (userCell) {
        // Occasionally hover over the user cell first (20% chance)
        if (Math.random() < 0.2) {
          await simulateMouseEvents(userCell);
          await randomSleep({ min: 0.5, max: 1 });
        }
        
        const followsYou = userCell.querySelector($followIndicator);
        if (!followsYou) {
          const success = await unfollowUser(followButton);
          if (success) {
            unfollowedCount++;
            state.totalUnfollowed++;
            console.log(`Unfollowed: ${state.totalUnfollowed} total`);
          }
          await randomSleep(); // 2-4 second delay between actions
        }
      }
    }

    console.log(`Unfollowed ${unfollowedCount} in this batch`);
    return unfollowedCount;
  };

  const nextBatch = async (isFirstBatch = false) => {
    if (!isFirstBatch) {
      scrollSmallAmount(); // Changed from scrollToTheBottom
      await randomSleep({ min: 1, max: 2 });
    }

    const followButtons = Array.from(document.querySelectorAll($followButtons));
    
    if (followButtons.length > 0) {
      const unfollowedInBatch = await unfollowNonFollowers(followButtons);
      
      if (unfollowedInBatch === 0) {
        addNewRetry();
      } else {
        state.retry.count = 0;
      }
      
      await randomSleep({ min: 1, max: 2 });
      return nextBatch();
    } else {
      addNewRetry();
    }

    if (retryLimitReached()) {
      console.log(`Complete! Total unfollowed: ${state.totalUnfollowed}`);
      if (state.consecutiveErrors > 5) {
        console.log(`High error count (${state.consecutiveErrors}) may indicate rate limiting`);
      }
    } else {
      await randomSleep({ min: 2, max: 3 });
      return nextBatch();
    }
  };

  // Start
  console.log('Starting Twitter unfollow script...');
  console.log('Base delay: 2-4 seconds between actions');
  console.log(`First break scheduled at ${state.nextBreakAt} unfollows`);
  nextBatch(true);
})();
