import { BiLogOut } from "react-icons/bi";

const LogoutButton = () => {
  return (
    <div className="fixed bottom-0 left-0 w-full flex pb-4">
      <BiLogOut className="w-6 h-6 text-white cursor-pointer" />
    </div>
  );
};

export default LogoutButton;
