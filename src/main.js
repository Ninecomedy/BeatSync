import './styles.css';
import('./ui/app.js')
  .then(({ mount }) => mount())
  .catch((error) => {
    document.querySelector('#app').textContent = `เริ่มแอปไม่สำเร็จ: ${error.message}`;
  });
