// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   images: {
//     remotePatterns: [
//       { protocol: 'https', hostname: 'api.dicebear.com' },
//       { protocol: 'https', hostname: 'ui-avatars.com' },
//     ],
//   },
//   // Allow Telegram WebApp embedding
//   async headers() {
//     return [
//       {
//         source: '/(.*)',
//         headers: [
//           { key: 'X-Frame-Options', value: 'ALLOWALL' },
//           { key: 'Content-Security-Policy', value: "frame-ancestors *" },
//         ],
//       },
//     ]
//   },
// }

// module.exports = nextConfig

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
      {
        source: '/ar-scene.html',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://aframe.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://cdn.jsdelivr.net",
              "media-src 'self' blob:",
              "connect-src 'self' https://cdn.jsdelivr.net blob:",
              "worker-src 'self' blob:",
              "camera *",
            ].join('; '),
          },
          { key: 'Feature-Policy', value: 'camera *' },
          { key: 'Permissions-Policy', value: 'camera=*' },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
