const MANAGER_USER_IDS = [1, 2];

function toNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function isManagerUser(user) {
  if (!user) {
    return false;
  }
  if (user.canManage === true || user.manager === true || user.isManager === true) {
    return true;
  }
  return MANAGER_USER_IDS.indexOf(toNumber(user.id)) >= 0;
}

module.exports = {
  MANAGER_USER_IDS,
  isManagerUser
};
