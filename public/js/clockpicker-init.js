// Time Policy ClockPicker Initialization
$(function() {
  console.log('Initialize time policy clockpicker');
  
  // Make sure jQuery and ClockPicker are available
  if (typeof $ === 'undefined') {
    console.error('jQuery is not available');
    return;
  }
  
  if (typeof $.fn.clockpicker !== 'function') {
    console.error('ClockPicker plugin is not available');
    return;
  }  // Initialize clockpicker for time inputs
  $('.clockpicker').clockpicker({
    autoclose: true,
    donetext: 'Valider',
    twelvehour: false,
    placement: 'right', // Position to the right of the input
    align: 'top',      // Align with the top of the input
    
    // Format time as HH:MM (no seconds)
    afterDone: function() {
      const input = $(this.input);
      let timeValue = input.val();
      
      // Ensure it's in HH:MM format
      if (timeValue && timeValue.includes(':')) {
        const parts = timeValue.split(':');
        if (parts.length >= 2) {
          // Just keep hours and minutes, format as HH:MM
          const formattedTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
          input.val(formattedTime);
        }
      }
    },
    
    // Before showing the popover
    beforeShow: function() {
      // Get input position for better placement
      const input = $(this).find('input');
      const inputOffset = input.offset();
      const inputWidth = input.outerWidth();
      
      // Store original position data
      $(this).data('inputPos', {
        top: inputOffset.top,
        left: inputOffset.left + inputWidth + 5 // Position beside the input with a small gap
      });
    },
    
    // After showing the popover, adjust position if needed
    afterShow: function() {
      const popover = $('.clockpicker-popover');
      const posData = $(this).data('inputPos');
      
      if (popover.length && posData) {
        // Position at the right of the input field
        popover.css({
          'top': posData.top - (popover.outerHeight() / 2) + 20 + 'px',
          'left': posData.left + 'px'
        });
        
        // Ensure popover is fully visible within viewport
        const windowHeight = $(window).height();
        const windowWidth = $(window).width();
        const popoverTop = popover.offset().top;
        const popoverLeft = popover.offset().left;
        const popoverHeight = popover.outerHeight();
        const popoverWidth = popover.outerWidth();
        
        // Adjust if off bottom
        if (popoverTop + popoverHeight > windowHeight) {
          popover.css('top', (windowHeight - popoverHeight - 10) + 'px');
        }
        
        // Adjust if off right edge
        if (popoverLeft + popoverWidth > windowWidth) {
          // Reposition to the left of the input
          popover.css('left', (posData.left - popoverWidth - inputWidth - 10) + 'px');
          
          // If still off-screen, move to a safe position
          if (popover.offset().left < 10) {
            popover.css('left', '10px');
          }
        }
      }
    }
  });
    // Clock icons have been removed, no need for click handler
  
  console.log('ClockPicker initialization complete');
});
