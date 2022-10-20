let $ = x => document.querySelector(x);

let delayed_action_timer_id = 0;
let delayed_action_timeout = 0;
let sample_queue_id = 0;
let sample_queue = [
  { type: 'match', stage: 0 },
  { type: 'match', stage: 1 },
  { type: 'match', stage: 2, inbox: 'How are you doing?' },
  { type: 'verification' },
];

window.onload = () => {
  setCurrentPage(localStorage._registered ?
    'messages' : 'registration');
};

function initRegistrationPage() {
  let img = $('#acc-img');
  img.onclick = () => selectImg();
  img.src = localStorage.acc_img || '/null';
  updateVerCode();
  loadInputData();
  document.body.onchange = (e) => saveInputData(e.target);
  $('#tos-checkbox').checked = false;
  $('#tos-checkbox').onchange = (e) => updateTosCheckbox(e.target);
  $('#register').onclick = () => completeRegistration();
  updateVerStatus();
}

function loadInputData() {
  for (let input of document.querySelectorAll('input,select')) {
    let value = localStorage[input.id];
    if (value) input.value = value;
    input.checkValidity();
  }
}

function saveInputData(input) {
  if (!input.id.startsWith('acc_'))
    return;
  if (input.value)
    localStorage[input.id] = input.value;
  else
    localStorage.removeItem(input.id);
  $('#status').textContent = '';
}

async function selectImg() {
  let img = $('#acc-img');
  let input = $('#img-input');
  let canvas = $('#img-canvas');
  // let the user pick a file
  await new Promise(resolve => {
    input.onchange = () => resolve();
    input.click();
  });
  let file = input.files[0];
  if (!file) return;
  console.log(file.name, file.type, file.size, 'bytes');
  // show the image
  img.src = URL.createObjectURL(file);
  await new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject();
  });
  // get base64 image data
  let ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let img_base64 = canvas.toDataURL('image/jpeg');
  // save it to cache & display the base64 url
  console.log('Resized img.src base64:', img_base64.length, 'bytes',
    canvas.width, 'x', canvas.height);
  localStorage.acc_img = img_base64;
  img.src = img_base64;
}

async function updateVerStatus() {
  let code = localStorage.ver_code;
  let addr = localStorage.ver_addr;
  if (!code || !addr)
    throw new Error('Ver code missing');
  console.log('Checking verification status...');
  let resp = await fetch('/me', {
    method: 'GET',
    headers: { 'Verification-Code': code + ':' + addr },
  });
  $('#ver-status-value').textContent =
    resp.status == 200 ? 'Verified' : 'Unverified';
}

function updateVerCode(parent_el = $('#page-registration')) {
  let code = localStorage.ver_code ||
    [0, 1, 2, 3, 4, 5].map(x => Math.random() * 10 | 0).join('');
  let addr = localStorage.ver_addr ||
    [0, 1, 2, 3, 4, 5].map(x => Math.random() * 10 | 0).join('');
  localStorage.ver_code = code;
  localStorage.ver_addr = addr;
  let el_code = parent_el.querySelector('.ver-code');
  let el_addr = parent_el.querySelector('.ver-addr');
  el_code.textContent = code;
  el_addr.textContent = addr + '@demo.org';
  el_addr.setAttribute('href', 'mailto:' + addr + '@demo.org');
}

function updateTosCheckbox(input) {
  if (input.checked) {
    $('#register').removeAttribute('disabled');
  } else {
    $('#register').setAttribute('disabled', '');
  }
}

function verifyUserInput() {
  let valid = true;
  let img = $('#acc-img');
  let has_img = !!localStorage.acc_img;
  img.classList.toggle('invalid', !has_img);
  valid = valid && has_img;

  for (let input of document.querySelectorAll('input,select')) {
    let is_valid = input.validity.valid &&
      (input.value || !input.required);
    input.classList.toggle('invalid', !is_valid);
    valid = valid && is_valid;
  }
  if (!valid)
    throw new Error('Fill out all required fields');
}

function getCurrentPage() {
  return document.body.getAttribute('page');
}

function setCurrentPage(page) {
  console.log('Opening page:', page);
  document.body.setAttribute('page', page);
  document.title = page[0].toUpperCase() + page.slice(1) + ' | Demo';

  let initPage = {
    registration: initRegistrationPage,
    messages: initMessagesPage,
  }[page];

  initPage();
}

function initMessagesPage() {
  $('#hdr-img').src = localStorage.acc_img || '/null';
  $('#hdr-img').onclick = () => setCurrentPage('registration');
  $('#hdr-name').textContent = localStorage.acc_name;
  updateVerCode($('#msg-verification'));

  $('#msg-match img').src = localStorage.acc_img || '/null';
  $('#msg-match .name').textContent = localStorage.acc_name;
  $('#msg-match .title').textContent = localStorage.acc_title;
  $('#msg-match .linkedin').textContent = localStorage.acc_linkedin || 'No linkedin URL';

  $('#msg-match .cancel').onclick = () => cancelDelayedAction();
  cancelDelayedAction();

  setQueueId(0);
  $('#msg-match button.no').onclick = () => scheduleDelayedAction(() => setQueueId(3));
  $('#msg-match button.yes').onclick = () => scheduleDelayedAction(() => setQueueId(sample_queue_id + 1));
  $('#msg-match button.send').onclick = () => scheduleDelayedAction(() => setQueueId(sample_queue_id + 1));
}

function scheduleDelayedAction(callback) {
  cancelDelayedAction();
  for (let button of $('#msg-match').querySelectorAll('button'))
    button.setAttribute('disabled', 'disabled');
  $('#msg-match .timer').style.display = '';
  $('#msg-match .remaining').textContent = 9;
  delayed_action_timeout = 9;
  delayed_action_timer_id = setInterval(() => {
    delayed_action_timeout--;
    $('#msg-match .remaining').textContent = delayed_action_timeout;
    if (delayed_action_timeout < 1) {
      cancelDelayedAction();
      callback();
    }
  }, 1000);
}

function cancelDelayedAction() {
  clearInterval(delayed_action_timer_id);
  delayed_action_timer_id = 0;
  $('#msg-match .timer').style.display = 'none';
  for (let button of $('#msg-match').querySelectorAll('button'))
    button.removeAttribute('disabled');
}

function setQueueId(id) {
  sample_queue_id = id;
  showUnprocessedRequest(sample_queue[id])
}

function showUnprocessedRequest({ type, stage, inbox }) {
  $('#cur-msg').setAttribute('type', type);
  $('#msg-match').setAttribute('stage', stage || 0);
  $('#msg-match .inbox').textContent = inbox || '';
  $('#msg-match textarea').value = '';
}

async function completeRegistration() {
  try {
    verifyUserInput();
    localStorage._registered = 1;
    setCurrentPage('messages');
  } catch (err) {
    $('#status').textContent = err;
  }
}

async function registerAccount() {
  let json = JSON.stringify(localStorage);
  console.log('Reg data:', json.length, 'bytes');

  let resp = await fetch('/me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
  });

  if (resp.status != 200)
    throw new Error(resp.status + ' ' + resp.statusText);

  localStorage._verified = 1;
}
