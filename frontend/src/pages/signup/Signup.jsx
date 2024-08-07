import GenderCheckerbox from "./GenderCheckerbox";

const Signup = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen min-w-96">
      <div className="w-full max-w-md bg-green-900 rounded-md bg-clip-padding backdrop-filter backdrop-blur-sm bg-opacity-10 p-6">
        <h1 className="text-3xl font-semibold text-center text-gray-900">
          Signup<span className="text-purple-900"> Talkify</span>
        </h1>
        <form className="mt-6">
          <div>
            <label className="label p-2">
              <span className="text-base label-text">Full Name</span>
            </label>
            <input
              type="text"
              placeholder="Enter Full Name"
              className="h-10 input input-ghost w-full"
            />
          </div>
          <div>
            <label className="label p-2">
              <span className="text-base label-text">Username</span>
            </label>
            <input
              type="text"
              placeholder="Enter Username"
              className="h-10 input input-ghost w-full"
            />
          </div>
          <div className="mt-4">
            <label className="label">
              <span className="text-base label-text">Password</span>
            </label>
            <input
              type="password"
              placeholder="Enter Password"
              className="input input-ghost w-full"
            />
          </div>
          <div className="mt-4">
            <label className="label">
              <span className="text-base label-text">Confirm Password</span>
            </label>
            <input
              type="password"
              placeholder="Confirm Password"
              className="input input-ghost w-full"
            />
          </div>
          <GenderCheckerbox/>
          <div className="mt-4">
            <a
              href="#"
              className="text-sm hover:underline hover:text-blue-800 inline-block"
            >
              Already have an account?
            </a>
          </div>
          <div className="mt-4">
            <button className="btn btn-block btn-sm">Signup</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
