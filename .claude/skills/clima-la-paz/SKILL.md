---
name: clima-la-paz
description: Consulta el clima actual y el pronóstico del día en La Paz, Bolivia (temperatura, sensación térmica, humedad, viento, máxima y mínima). Úsalo cuando el usuario pregunte por el clima, la temperatura o el tiempo en su ciudad.
---

# Clima en La Paz, Bolivia

Obtiene el clima local con la API gratuita de Open-Meteo (sin clave).

## Pasos

1. Llama a WebFetch con esta URL (lat -16.5, lon -68.15, zona America/La_Paz):

   `https://api.open-meteo.com/v1/forecast?latitude=-16.5&longitude=-68.15&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=America/La_Paz&forecast_days=1`

   Prompt sugerido: "Dame temperatura actual, sensación térmica, humedad, viento, weather_code y máxima/mínima de hoy, con unidades y hora."

2. Si WebFetch no está cargado, cárgalo antes con `ToolSearch("select:WebFetch")`.

3. Responde en español, en formato corto:
   - Temperatura (y sensación térmica) en °C
   - Cielo (traduce `weather_code` WMO: 0 despejado, 1-3 parcialmente nublado/nublado, 45-48 niebla, 51-67 lluvia/llovizna, 71-77 nieve, 80-82 chubascos, 95-99 tormenta)
   - Humedad (%) y viento (km/h)
   - Máxima y mínima del día
   - Una recomendación breve si aplica (La Paz enfría rápido al caer el sol)

## Notas

- Indica siempre la hora de la lectura (zona GMT-4).
- Si el usuario pide otra ciudad, cambia `latitude`/`longitude` en la URL.
- Si la API falla, dilo claramente; no inventes datos.
