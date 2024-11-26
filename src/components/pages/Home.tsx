import Link from "next/link";

const Home = () => {
  return <div className="h-screen w-screen">
    <div className="flex flex-col items-center justify-center h-full">
    <h1 className="text-4xl font-black text-center mb-8 italic">MNEE</h1>
    <Link href="/login" className="btn btn-primary">Login</Link>
    </div>
  </div>
}

export default Home;