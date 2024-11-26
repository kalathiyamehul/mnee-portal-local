const DashboardAdminContent = () => {
	return (
		<div>
			<div>
				<p>These functions require approval from another admin.</p>
				Free, Unfreeze, Pause, Resume, Mint / Burn
			</div>
			<div className="my-4">
				<form>
					<input type="text" name="freeze" className="input" />
					<button type="submit" className="btn btn-primary">
						Freeze
					</button>
				</form>
			</div>
			<div className="my-4">
				<form>
					<input type="text" name="pause" className="input" />
					<button type="submit" className="btn btn-primary">
						Pause
					</button>
				</form>
			</div>
			<div className="my-4">
				<h2 className="text-2xl">Pending Actions</h2>
				<div>
					- thing 1<br />- thing 2
				</div>
			</div>
			<div className="my-4">
				<h2 className="text-2xl">Blacklist</h2>
				<p>Blacklist can be done by a single admin</p>

				<div>
					- address 1<br />- address 2
				</div>
			</div>
		</div>
	);
};

export default DashboardAdminContent;
