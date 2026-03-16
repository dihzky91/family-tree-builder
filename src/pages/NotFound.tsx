import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="max-w-md text-center">
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="mb-3 text-3xl font-display font-bold">Halaman tidak ditemukan</h1>
        <p className="mb-6 text-muted-foreground">
          Halaman yang kamu buka tidak tersedia atau sudah dipindahkan.
        </p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
