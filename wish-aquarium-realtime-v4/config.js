/*
 * 같은 Node.js 서버에서 웹사이트를 함께 서비스할 때는 빈 값으로 둡니다.
 * 정적 웹사이트와 Socket.io 서버를 분리할 때만 서버 주소를 입력하세요.
 * 예: socketUrl: 'https://aquarium-socket.example.com'
 */
window.WISH_AQUARIUM_CONFIG = {
  socketUrl: '',
  connectionTimeoutMs: 8000
};
