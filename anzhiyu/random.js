var posts=["post/25e55a24.html","post/d1404c7.html","post/da12a90d.html","post/263e1d83.html","post/82e04830.html","post/5a5a2105.html","post/eeedc6e3.html","post/981fdb07.html","post/c6afcc96.html","post/7f23af61.html","post/25b17150.html","post/a7faaa19.html","post/75ec601e.html","post/8002f382.html","post/45a1a561.html","post/2477713e.html","post/4a72f5c3.html"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };