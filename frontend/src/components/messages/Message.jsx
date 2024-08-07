const Message = () => {
  return (
    <div className="chat chat-end">
      <div className="chat-image avatar">
        <div className="w-10 rounded-full">
          <img alt="" src="" />
        </div>
      </div>
      <div>
        <div className={`chat-bubble text-white bg-purple-600`}>
          Hi! what is up
        </div>
        <div className="chat-footer opacity-50 text-xs flex gap-1 items-center">
          11:11
        </div>
      </div>
    </div>
  );
};

export default Message;
