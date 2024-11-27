"use client";

/* eslint-disable @next/next/no-img-element */

import { FaBitcoinSign, FaUsers, FaDollarSign } from "react-icons/fa6";
import { useEffect, useState } from "react";

type Activity = {
	outpoint: string;
	height: number;
};

const DashboardHomeContent = () => {
	const [addresses, setAddresses] = useState(0);
	const [transactions, setTransactions] = useState(0);
	const [activity, setActivity] = useState<Activity[]>([]);
    const [volume24h, setVolume24h] = useState(0);

	useEffect(() => {
		fetch(`${process.env.NEXT_PUBLIC_MNEE_API}/v1/addresses`)
			.then((response) => response.json())
			.then((data) => setAddresses(data.count));

		fetch(`${process.env.NEXT_PUBLIC_MNEE_API}/v1/transactions`)
			.then((response) => response.json())
			.then((data) => setTransactions(data.count));

        fetch(`${process.env.NEXT_PUBLIC_MNEE_API}/v1/activity`)
			.then((response) => response.json())
			.then((data) => setActivity(data));

        fetch(`${process.env.NEXT_PUBLIC_MNEE_API}/v1/volume`)
            .then((response) => response.json())
            .then((data) => setVolume24h(data.volume));
	}, []);

	return (
		<div className="mt-4">
			<div>
				<div className="flex flex-wrap -mx-6">
					<div className="w-full px-6 sm:w-1/2 xl:w-1/3">
						<div className="flex items-center px-5 py-6 bg-base-100 rounded-md shadow-xs">
							<div className="p-3 bg-indigo-600 bg-opacity-75 rounded-full">
								<FaUsers className="w-6 h-6" />
							</div>
							<div className="mx-5">
								<h4 className="text-2xl font-semibold text-gray-700">
									{addresses}
								</h4>
								<div className="text-gray-500">Addresses</div>
							</div>
						</div>
					</div>

					<div className="w-full px-6 mt-6 sm:w-1/2 xl:w-1/3 sm:mt-0">
						<div className="flex items-center px-5 py-6 bg-base-100 rounded-md shadow-xs">
							<div className="p-3 bg-orange-600 bg-opacity-75 rounded-full">
								<FaBitcoinSign className="w-6 h-6" />
							</div>
							<div className="mx-5">
								<h4 className="text-2xl font-semibold text-gray-700">
									{transactions}
								</h4>
								<div className="text-gray-500">Transactions</div>
							</div>
						</div>
					</div>

					<div className="w-full px-6 mt-6 sm:w-1/2 xl:w-1/3 xl:mt-0">
						<div className="flex items-center px-5 py-6 bg-base-100 rounded-md shadow-xs">
							<div className="p-3 bg-pink-600 bg-opacity-75 rounded-full text-sm w-16 h-16 flex items-center justify-center">
								MNEE
							</div>

							<div className="mx-5">
								<h4 className="text-2xl font-semibold text-gray-700 flex items-center">
									<FaDollarSign className="mr-2 text-lg" /> {volume24h}
								</h4>
								<div className="text-gray-500">24h Volume</div>
							</div>
						</div>
					</div>
				</div>
			</div>
			<div className="flex flex-col mt-8">
				<div className="flex flex-col mt-8">
					<div className="py-2 -my-2 overflow-x-auto sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
						<div className="inline-block min-w-full overflow-hidden align-middle border-b border-gray-200 shadow-sm sm:rounded-lg">
							<table className="min-w-full">
								<thead>
									<tr>
										<th className="px-6 py-3 text-xs font-medium leading-4 tracking-wider text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
											Name
										</th>
										<th className="px-6 py-3 text-xs font-medium leading-4 tracking-wider text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
											Title
										</th>
										<th className="px-6 py-3 text-xs font-medium leading-4 tracking-wider text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
											Status
										</th>
										<th className="px-6 py-3 text-xs font-medium leading-4 tracking-wider text-left text-gray-500 uppercase border-b border-gray-200 bg-gray-50">
											Role
										</th>
										<th className="px-6 py-3 border-b border-gray-200 bg-gray-50" />
									</tr>
								</thead>

								<tbody className="bg-white">
										{activity.map((user) => (
											<tr key={user.outpoint}>
												<td className="px-6 py-4 whitespace-no-wrap border-b border-gray-200">
													<div className="flex items-center">
														<div className="shrink-0 w-10 h-10">
															{/* <img
																className="w-10 h-10 rounded-full"
																src={user.avatarUrl}
																alt={user.name}
															/> */}
                                                            X
														</div>
														<div className="ml-4">
															<div className="text-sm font-medium leading-5 text-gray-900">
																{user.height}
															</div>
														</div>
													</div>
												</td>
												{/* Add other table cells as needed */}
											</tr>
										))}
									</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default DashboardHomeContent;
