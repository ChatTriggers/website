(function ($) {
  $(document).ready(function(){
    updateScroll();

    // scroll
  	$(function () {
  		$(window).scroll(function () {
        updateScroll();
  		});
  	});

  });
}(jQuery));

function updateScroll() {
  // title shrink
  if ($(this).scrollTop() < 244) {
    var w = 490 - $(this).scrollTop() / 2;
    $("#title-image").width(w).css("margin-left", -w/2).css("margin-top", -$(this).scrollTop());
    $("#navigation").css("font-size", $(this).scrollTop() / 15 + 15).css("padding-top", $(this).scrollTop() / 20).css("padding-bottom", $(this).scrollTop() / 20);
  } else {
    $("#title-image").width(365).css("margin-left", -182.5).css("margin-top", -250);
    $("#navigation").css("font-size", 31).css("padding-top", 12).css("padding-bottom", 12);
  }

  if ($(this).scrollTop() < $("#download")[0].scrollHeight + $("#download").innerHeight() + 400 && $(this).scrollTop() > $("#download")[0].scrollHeight + 500) {
    $("#download-image").addClass("active");
  } else {
    $("#download-image").removeClass("active");
  }
}

var hashTagActive = "";
$(".scroll").on("click touchstart" , function (event) {
    if(hashTagActive != this.hash) {
        event.preventDefault();
        
        var dest = 0;
        if ($(this.hash).offset().top > $(document).height() - $(window).height()) {
            dest = $(document).height() - $(window).height();
        } else {
            dest = $(this.hash).offset().top;
        }

        $('html,body').animate({
            scrollTop: dest
        }, 500, 'swing');
        hashTagActive = this.hash;
    }
});
