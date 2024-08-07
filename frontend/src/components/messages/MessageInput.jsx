import { BiSolidSend } from "react-icons/bi";

const MessageInput = () => {
  return (
    <div className="px-4 my-3">
      <div className="w-full relative">
        <input
          type="text"
          className="border text-sm rounded-lg block w-full p-2.5 bg-black border-purple-400 text-white"
          placeholder="Type a message"
        />
        <button type="submit" className="absolute inset-y-0 end-0 flex items-center pe-3">
            <BiSolidSend/>
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
