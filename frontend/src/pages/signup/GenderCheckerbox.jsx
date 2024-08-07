
const GenderCheckerbox = () => {
  return (
    <div className='flex'>
        <div className='form-control'>
            <label className={`label gap-2 cursor-pointer`}>
                <span className='label-text'>Male</span>
                <input type='checkbox' className='checkbox'></input>
            </label>
        </div> 
        <div className='form-control'>
            <label className={`label gap-2 cursor-pointer`}>
                <span className='label-text'>Female</span>
                <input type='checkbox' className='checkbox'></input>
            </label>
        </div>
    </div>
  )
}

export default GenderCheckerbox