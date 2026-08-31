/** @type {import('next').NextConfig} */
const nextConfig = {
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/ingreso',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;