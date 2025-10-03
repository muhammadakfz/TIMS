import { useState, useEffect, useRef } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../lib/firebase";
import { Inter } from 'next/font/google';
import { FireIcon } from '@heroicons/react/24/outline';
import AiInsight from "../components/AiInsight";

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Helper: draw rounded rectangle similar to OLED "fillRoundRect"
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawEyeExpression(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  expr: string
) {
  ctx.save();
  ctx.beginPath();
  const radius = 5; // Match ESP32 corner radius
  if (expr === 'normal') {
    roundRect(ctx, x, y, w, h, radius);
  } else if (expr === 'cold') {
    roundRect(ctx, x, y + 5, w, h - 10, radius);
  } else if (expr === 'hot') {
    roundRect(ctx, x, y - 5, w, h - 10, radius);
  } else {
    roundRect(ctx, x, y, w, h, radius);
  }
  ctx.fillStyle = 'white';
  ctx.fill();
  ctx.restore();
}

function drawBlink(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = 'white';
  // Draw a horizontal line for the blink, matching the ESP32's fillRect
  ctx.fillRect(x, y + h / 2 - 2, w, 4);
  ctx.restore();
}

export default function Home() {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Use a ref to pass the latest temperature to the animation loop without re-triggering the effect
  const temperatureRef = useRef<number | null>(null);
  useEffect(() => {
    temperatureRef.current = temperature;
  }, [temperature]);

  useEffect(() => {
    const tempRef = ref(database, 'sensor/temperature');
    const unsubscribeTemp = onValue(tempRef, (snapshot) => {
      const value = snapshot.val();
      setTemperature(value);
      setLoading(false);
    });
    return () => {
      unsubscribeTemp();
    };
  }, []);

  useEffect(() => {
    // Constants from ESP32 code
    const leftEyeX = 45, rightEyeX = 80, eyeY = 18;
    const eyeWidth = 25, eyeHeight = 30;
    const moveSpeed = 5;

    // Animation state variables (not React state to prevent re-renders)
    let blinkState = 0; // 0 = open, 1 = closed
    let lastBlinkTime = 0;
    
    let offsetX = 0, offsetY = 0;
    let targetOffsetX = 0, targetOffsetY = 0;
    let moveTime = 0;
    let nextMoveInterval = randRange(1500, 3000);

    function randRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    function pickMovement() {
      const movementType = Math.floor(Math.random() * 8);
      switch (movementType) {
        case 0: targetOffsetX = -10; targetOffsetY = 0; break;
        case 1: targetOffsetX = 10; targetOffsetY = 0; break;
        case 2: targetOffsetX = -10; targetOffsetY = -8; break;
        case 3: targetOffsetX = 10; targetOffsetY = -8; break;
        case 4: targetOffsetX = -10; targetOffsetY = 8; break;
        case 5: targetOffsetX = 10; targetOffsetY = 8; break;
        default: targetOffsetX = 0; targetOffsetY = 0; break;
      }
    }

    function currentExpression(): string {
      const t = temperatureRef.current;
      if (t === null) return 'normal';
      if (t < 20) return 'cold';
      if (t <= 30) return 'normal';
      return 'hot';
    }

    let animationFrameId: number;
    function animate(currentTime: number) {
      // Blink logic
      if (blinkState === 0 && currentTime - lastBlinkTime > 4000) {
        blinkState = 1;
        lastBlinkTime = currentTime;
      } else if (blinkState === 1 && currentTime - lastBlinkTime > 150) {
        blinkState = 0;
        lastBlinkTime = currentTime;
      }

      // Random movement logic
      if (blinkState === 0 && currentTime - moveTime > nextMoveInterval) {
        pickMovement();
        moveTime = currentTime;
        nextMoveInterval = randRange(1500, 3000);
      }

      // Smoothly update offset
      offsetX += (targetOffsetX - offsetX) / moveSpeed;
      offsetY += (targetOffsetY - offsetY) / moveSpeed;

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const expr = currentExpression();

          if (blinkState === 0) {
            drawEyeExpression(ctx, leftEyeX + offsetX, eyeY + offsetY, eyeWidth, eyeHeight, expr);
            drawEyeExpression(ctx, rightEyeX + offsetX, eyeY + offsetY, eyeWidth, eyeHeight, expr);
          } else {
            drawBlink(ctx, leftEyeX + offsetX, eyeY + offsetY, eyeWidth, eyeHeight);
            drawBlink(ctx, rightEyeX + offsetX, eyeY + offsetY, eyeWidth, eyeHeight);
          }
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    }
    
    animate(0);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className={`${inter.variable} min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center p-6`}>
      <div className="max-w-md w-full bg-black/50 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/10">
        <header className="mb-6 text-center">
          <h1 className="text-5xl font-extrabold text-white mb-1 font-sans">TIMS</h1>
          <canvas 
            ref={canvasRef} 
            width={128} 
            height={64} 
            className="mx-auto mb-4 bg-black border border-white/10 rounded-md"
          />
          <p className="text-gray-300 italic mb-3">Thermal Intelligent Measurement System</p>
        </header>

        <main className="flex flex-col items-center">
          {loading ? (
            <div className="flex flex-col items-center py-8">
              <svg className="animate-spin h-10 w-10 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <p className="mt-4 text-gray-300">Loading sensor data...</p>
            </div>
          ) : (
            <div className="w-full">
              <div className="bg-white/10 rounded-lg p-6 mb-4 transform transition hover:scale-105 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-medium text-white">Temperature</h2>
                  <FireIcon className="h-6 w-6 text-red-400" />
                </div>
                <p className="mt-2 text-5xl font-bold text-white font-mono tracking-wide">
                  {temperature !== null ? `${temperature.toFixed(1)}°C` : '--'}
                </p>
              </div>
            </div>
          )}
        </main>
        <AiInsight temperature={temperature} sensorLoading={loading} />

        <footer className="mt-8 text-center text-gray-400 text-sm">
          © {new Date().getFullYear()} Made with ❤️ by Kelompok 5
        </footer>
      </div>
    </div>
  );
}

