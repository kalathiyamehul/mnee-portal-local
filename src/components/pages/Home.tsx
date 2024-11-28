import Link from "next/link";

const Home = () => {
	return (
		<div className="h-screen w-screen">
			<div className="flex flex-col items-center justify-center h-full">
				<h1 className="text-4xl font-black text-center mb-8 italic">MNEE</h1>
				<div className="flex flex-row gap-4">
					<Link href="/login" className="btn btn-primary">
						Login
					</Link>
					<Link href="/login" className="btn btn-primary">
						Signup
					</Link>
				</div>
			</div>
		</div>
	);
};

export default Home;
