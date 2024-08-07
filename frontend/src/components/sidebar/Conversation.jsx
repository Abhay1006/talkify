const Conversation = () => {
  return (
    <>
      <div className="flex gap-2 items-center hover:bg-purple-600 rounded p-2 py-1 cursor-pointer">
        <div className="avatar online">
          <div className="w-10 h-10 rounded-full">
            <img src="" alt="" />
          </div>
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex gap-3 justify-between">
            <p className="font-bold text-gray-200">Abhay</p>
            <span className="text-xl">⚽</span>
          </div>
        </div>
      </div>
      <div className="divider my-0 py-0 h-1" />
    </>
  );
};

export default Conversation;
