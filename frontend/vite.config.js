import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Port 5173 is the one the backend allows (CORS in backend/app/main.py)
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
