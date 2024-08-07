const Login = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-md bg-white-0 rounded-md bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-20 p-6">
        <h1 className="text-3xl font-semibold text-center text-gray-900">
          Login<span className="text-purple-900"> Talkify</span>
        </h1>
        <form className="mt-6">
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
          <a
            href="#"
            className="text-sm hover:underline hover:text-blue-800 mt-2 inline-block"
          >
            {"Dont't"} have an account?
          </a>
          <div>
            <button className="btn btn-block btn-sm mt-2">Login</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
