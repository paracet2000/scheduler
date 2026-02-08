module.exports = async function applyChange(request) {
  const schedule = await Schedule.findById(request.scheduleId);
  if (!schedule) throw new Error('Schedule not found');

  switch (request.type) {
    case 'LEAVE':
      schedule.status = 'LEAVE';
      break;

    case 'SWAP':
    case 'CHANGE':
      schedule.user = request.acceptedBy;
      schedule.status = request.type;
      break;
  }

  schedule.changeRequest = request._id;
  await schedule.save();

  return schedule;
};
