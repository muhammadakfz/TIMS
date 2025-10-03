import { useState, useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { database } from "../lib/firebase";

export default function Home() {
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tempRef = ref(database, 'sensor/temperature');
    const humRef = ref(database, 'sensor/humidity');

    const unsubscribeTemp = onValue(tempRef, (snapshot) => {
      const value = snapshot.val();
      setTemperature(value);
      setLoading(false);
    });

    const unsubscribeHum = onValue(humRef, (snapshot) => {
      const value = snapshot.val();
      setHumidity(value);
      setLoading(false);
    });

    // Cleanup function
    return () => {
      unsubscribeTemp();
      unsubscribeHum();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-white">
          Sensor Dashboard
        </h1>
        
        {loading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-300">Loading sensor data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Temperature Card */}
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">Temperature</h2>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400" id="temp">
                    {temperature !== null ? `${temperature} °C` : 'No data'}
                  </p>
                </div>
                <div className="text-4xl">🌡️</div>
              </div>
            </div>

            {/* Humidity Card */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-blue-800 dark:text-blue-200">Humidity</h2>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400" id="hum">
                    {humidity !== null ? `${humidity} %` : 'No data'}
                  </p>
                </div>
                <div className="text-4xl">💧</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time data from Firebase
          </p>
        </div>
      </div>
    </div>
  );
}
