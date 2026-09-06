const SUPABASE_URL = 'https://hkxegnjlxuscusygckqm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kO22Zj703int4nZp8ha9jg_hwgz5f9X';

const ADMIN_UID = '2b4b64c6-b96f-4b85-bce3-be28c141311e';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};


/* =========================
   APP DATA
========================= */

if (!localStorage.getItem('nexa_cart')) {
  store.set('nexa_cart', []);
}

if (!localStorage.getItem('nexa_orders')) {
  store.set('nexa_orders', []);
}

if (!localStorage.getItem('nexa_winners')) {
  store.set('nexa_winners', []);
}

let competitions = [];
let cart = store.get('nexa_cart', []);
let orders = store.get('nexa_orders', []);
let winners = store.get('nexa_winners', []);
let user = null;


/* =========================
   HELPERS
========================= */

function money(n) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(Number(n) || 0);
}

function escapeHtml(v = '') {
  return String(v).replace(
    /[&<>'"]/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c])
  );
}

function daysLeft(date) {
  const d = Math.ceil(
    (new Date(date) - new Date()) / 86400000
  );

  return d > 0
    ? `ENDS IN ${d} DAY${d === 1 ? '' : 'S'}`
    : 'CLOSING / CLOSED';
}

function toast(msg) {
  const t = $('#toast');

  if (!t) return;

  t.textContent = msg;
  t.classList.add('show');

  setTimeout(() => {
    t.classList.remove('show');
  }, 2200);
}

function openModal(id) {
  const modal = $(id);

  if (!modal) return;

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModals() {
  $$('.modal').forEach(modal => {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  });

  document.body.classList.remove('modal-open');
}


/* =========================
   SUPABASE COMPETITIONS
========================= */

async function loadCompetitionsFromSupabase() {

  const { data, error } = await supabaseClient
    .from('competitions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      'Supabase competitions error:',
      error
    );

    return;
  }

  competitions = (data || []).map(r => ({
    id: String(r.id),
    title: r.title || '',
    price: Number(r.price || 0),
    image: r.image_url || '',
    closes: r.closes_at,
    max: Number(r.max_entries || 0),
    sold: Number(r.sold || 0),
    status: r.status || 'live',
    description: r.description || '',
    skill_question: r.skill_question || '',
    skill_option_a: r.skill_option_a || '',
    skill_option_b: r.skill_option_b || '',
    skill_option_c: r.skill_option_c || ''
  }));

  renderDraws();
}


/* =========================
   PUBLIC DRAW CARDS
========================= */

function renderDraws() {

  const drawCards = $('#drawCards');

  if (!drawCards) return;

  const live = competitions.filter(
    c => c.status === 'live'
  );

  drawCards.innerHTML = live.length
    ? live.map(c => {

        const pct = c.max > 0
          ? Math.min(
              100,
              Math.round((c.sold / c.max) * 100)
            )
          : 0;

        return `
          <article class="card" data-id="${escapeHtml(c.id)}">

            <div class="card-img">

              <img
                src="${escapeHtml(c.image)}"
                alt="${escapeHtml(c.title)}"
              >

              <span>
                ${daysLeft(c.closes)}
              </span>

            </div>

            <div class="card-body">

              <h3>
                ${escapeHtml(c.title)}
              </h3>

              <p>
                ${money(c.price)} per entry
              </p>

              <div class="bar">
                <i style="width:${pct}%"></i>
              </div>

              <div class="stats">

                <b>
                  ${pct}% sold
                </b>

                <span>
                  ${c.sold.toLocaleString()}
                  /
                  ${c.max.toLocaleString()}
                </span>

              </div>

              <button
                class="enter"
                data-open-comp="${escapeHtml(c.id)}"
              >
                ENTER NOW
              </button>

            </div>

          </article>
        `;

      }).join('')

    : `
        <p class="empty">
          No live competitions right now.
        </p>
      `;

  $$('[data-open-comp]').forEach(button => {
    button.onclick = () => {
      showCompetition(
        button.dataset.openComp
      );
    };
  });
}


/* =========================
   COMPETITION ENTRY
========================= */

function showCompetition(id) {

  const c = competitions.find(
    x => x.id === id
  );

  if (!c) return;

  const remaining = Math.max(
    0,
    c.max - c.sold
  );

  const maximumChoice = Math.max(
    1,
    Math.min(100, remaining)
  );

  $('#competitionContent').innerHTML = `
    <div class="competition-detail">

      <img
        src="${escapeHtml(c.image)}"
        alt="${escapeHtml(c.title)}"
      >

      <div>

        <p class="eyebrow">
          LIVE COMPETITION
        </p>

        <h2>
          ${escapeHtml(c.title)}
        </h2>

        <p>
          ${escapeHtml(c.description)}
        </p>

        <div class="detail-price">
          ${money(c.price)}
          <small>per entry</small>
        </div>

        <p>
          <strong>
            ${remaining.toLocaleString()}
          </strong>

          entries remaining

          · closes

          ${
            c.closes
              ? new Date(c.closes)
                  .toLocaleString('en-GB')
              : 'TBC'
          }
        </p>

        ${
          remaining > 0

            ? `
              <label class="field">
                Number of entries

                <input
                  id="entryQty"
                  type="number"
                  min="1"
                  max="${maximumChoice}"
                  value="1"
                >
              </label>

              <button
                class="btn gold full"
                id="addToCart"
              >
                ADD TO BASKET
              </button>
            `

            : `
              <p>
                This competition has no entries remaining.
              </p>
            `
        }

        <p class="micro">
          Demo checkout only.
          No real payment is processed.
        </p>

      </div>

    </div>
  `;

  const addButton = $('#addToCart');

  if (addButton) {
    addButton.onclick = () => {
      openSkillQuestion(id);
    };
  }

  openModal('#competitionModal');
}


/* =========================
   SKILL QUESTION
========================= */

function openSkillQuestion(id) {

  const c = competitions.find(
    x => x.id === id
  );

  if (!c) return;

  const remaining = Math.max(
    0,
    c.max - c.sold
  );

  const qty = Math.max(
    1,
    Math.min(
      100,
      remaining,
      Number($('#entryQty')?.value) || 1
    )
  );

  $('#skillQuestion').textContent =
    c.skill_question ||
    'Skill question unavailable.';

  const options = [
    c.skill_option_a,
    c.skill_option_b,
    c.skill_option_c
  ].filter(Boolean);

  const answerContainer =
    $('#skillAnswers');

  answerContainer.innerHTML = '';

  options.forEach(option => {

    const button =
      document.createElement('button');

    button.className =
      'btn outline full';

    button.dataset.skill = option;
    button.textContent = option;

    answerContainer.appendChild(button);
  });

  $('#skillError').textContent = '';

  $$('[data-skill]').forEach(button => {

    button.onclick = async () => {

      $('#skillError').textContent =
        'Checking answer...';

      const { data, error } =
        await supabaseClient.functions.invoke(
          'check-skill-answer',
          {
            body: {
              competition_id: id,
              answer: button.dataset.skill
            }
          }
        );

      if (error) {

        console.error(
          'Skill answer check failed:',
          error
        );

        $('#skillError').textContent =
          'Unable to check your answer. Please try again.';

        return;
      }

      if (data?.correct) {

        addToCart(id, qty);

        closeModals();

        openCart();

      } else {

        $('#skillError').textContent =
          'Incorrect answer. Please try again.';
      }
    };
  });

  closeModals();
  openModal('#skillModal');
}


/* =========================
   BASKET
========================= */

function addToCart(id, qty) {

  cart = store.get(
    'nexa_cart',
    []
  );

  const c = competitions.find(
    x => x.id === id
  );

  if (!c) return;

  const remaining = Math.max(
    0,
    c.max - c.sold
  );

  if (remaining <= 0) {
    toast(
      'No entries remaining for this competition.'
    );

    return;
  }

  qty = Math.max(
    1,
    Math.min(
      Number(qty) || 1,
      100,
      remaining
    )
  );

  const found = cart.find(
    x => x.id === id
  );

  if (found) {

    found.qty = Math.min(
      found.qty + qty,
      100,
      remaining
    );

  } else {

    cart.push({
      id,
      qty
    });
  }

  store.set(
    'nexa_cart',
    cart
  );

  updateCartCount();

  toast(
    'Entries added to your basket'
  );
}


function updateCartCount() {

  cart = store.get(
    'nexa_cart',
    []
  );

  const count = cart.reduce(
    (total, item) =>
      total + Number(item.qty || 0),
    0
  );

  if ($('#cartCount')) {
    $('#cartCount').textContent =
      count;
  }
}


function openCart() {

  cart = store.get(
    'nexa_cart',
    []
  );

  /*
    Remove basket items for competitions
    that no longer exist.
  */

  cart = cart.filter(item =>
    competitions.some(
      c => c.id === item.id
    )
  );

  store.set(
    'nexa_cart',
    cart
  );

  let total = 0;

  const cartItems =
    $('#cartItems');

  cartItems.innerHTML = cart.length

    ? cart.map((item, i) => {

        const c = competitions.find(
          x => x.id === item.id
        );

        if (!c) return '';

        const line =
          c.price * item.qty;

        total += line;

        return `
          <div class="cart-line">

            <div>

              <strong>
                ${escapeHtml(c.title)}
              </strong>

              <small>
                ${item.qty}
                ×
                ${money(c.price)}
              </small>

            </div>

            <div>

              <b>
                ${money(line)}
              </b>

              <button
                class="remove"
                data-remove="${i}"
              >
                Remove
              </button>

            </div>

          </div>
        `;

      }).join('')

    : `
        <p class="empty">
          Your basket is empty.
        </p>
      `;

  $('#cartTotal').textContent =
    money(total);

  $$('[data-remove]').forEach(button => {

    button.onclick = () => {

      cart.splice(
        Number(button.dataset.remove),
        1
      );

      store.set(
        'nexa_cart',
        cart
      );

      updateCartCount();
      openCart();
    };
  });

  $('#checkoutBtn').disabled =
    !cart.length;

  openModal('#cartModal');
}


/* =========================
   CUSTOMER AUTH
========================= */

async function getCurrentCustomer() {

  const {
    data: { user: authUser }
  } = await supabaseClient.auth.getUser();

  if (!authUser) {
    user = null;
    return null;
  }

  user = {
    id: authUser.id,
    email: authUser.email,
    name:
      authUser.user_metadata?.name ||
      'Customer'
  };

  return user;
}


async function renderAccount(
  forceSignup = false
) {

  const authUser =
    await getCurrentCustomer();

  if (!authUser || forceSignup) {

    $('#accountContent').innerHTML = `
      <p class="eyebrow">
        CUSTOMER ACCOUNT
      </p>

      <h2>My Nexa</h2>

      <h3>Create Account</h3>

      <form id="signupForm">

        <label class="field">
          Name

          <input
            name="name"
            required
            autocomplete="name"
          >
        </label>

        <label class="field">
          Email

          <input
            name="email"
            type="email"
            required
            autocomplete="email"
          >
        </label>

        <label class="field">
          Password

          <input
            name="password"
            type="password"
            minlength="8"
            required
            autocomplete="new-password"
          >
        </label>

        <button
          class="btn gold full"
          type="submit"
        >
          CREATE ACCOUNT
        </button>

      </form>

      <hr>

      <h3>
        Already have an account?
      </h3>

      <form id="loginForm">

        <label class="field">
          Email

          <input
            name="email"
            type="email"
            required
            autocomplete="email"
          >
        </label>

        <label class="field">
          Password

          <input
            name="password"
            type="password"
            required
            autocomplete="current-password"
          >
        </label>

        <button
          class="btn outline full"
          type="submit"
        >
          LOG IN
        </button>

      </form>
    `;


    $('#signupForm').onsubmit =
      async e => {

        e.preventDefault();

        const fd =
          new FormData(e.target);

        const { error } =
          await supabaseClient.auth.signUp({
            email: fd.get('email'),
            password: fd.get('password'),
            options: {
              data: {
                name: fd.get('name')
              },

              emailRedirectTo:
                'http://nexadraw.co.uk/'
            }
          });

        if (error) {

          alert(
            'Sign up failed: ' +
            error.message
          );

          return;
        }

        alert(
          'Account created. Please check your email and confirm your account.'
        );
      };


    $('#loginForm').onsubmit =
      async e => {

        e.preventDefault();

        const fd =
          new FormData(e.target);

        const { data, error } =
          await supabaseClient.auth
            .signInWithPassword({
              email: fd.get('email'),
              password:
                fd.get('password')
            });

        if (error) {

          alert(
            'Login failed: ' +
            error.message
          );

          return;
        }

        user = {
          id: data.user.id,
          email: data.user.email,
          name:
            data.user.user_metadata?.name ||
            'Customer'
        };

        await updateAccountLabel();

        renderAccount(false);
      };

    return;
  }


  orders = store.get(
    'nexa_orders',
    []
  );

  const mine = orders.filter(
    o => o.userEmail === user.email
  );

  $('#accountContent').innerHTML = `
    <p class="eyebrow">
      MY NEXA
    </p>

    <h2>
      Welcome,
      ${escapeHtml(user.name)}
    </h2>

    <p>
      ${escapeHtml(user.email)}
    </p>

    <div class="account-orders">

      <h3>
        Your orders
      </h3>

      ${
        mine.length

          ? mine.map(order => `
              <div class="order">

                <div>

                  <strong>
                    ${escapeHtml(order.id)}
                  </strong>

                  <small>
                    ${
                      new Date(order.date)
                        .toLocaleString('en-GB')
                    }

                    ·

                    ${escapeHtml(order.status)}
                  </small>

                </div>

                <b>
                  ${money(order.total)}
                </b>

                <details>

                  <summary>
                    View tickets
                  </summary>

                  ${
                    order.items.map(item => `
                      <p>
                        ${escapeHtml(item.title)}
                        —
                        ${
                          item.tickets
                            .map(escapeHtml)
                            .join(', ')
                        }
                      </p>
                    `).join('')
                  }

                </details>

              </div>
            `).join('')

          : `
              <p class="empty">
                No orders yet.
              </p>
            `
      }

    </div>

    <button
      class="btn outline full"
      id="logoutBtn"
    >
      LOG OUT
    </button>
  `;


  $('#logoutBtn').onclick =
    async () => {

      await supabaseClient.auth
        .signOut();

      user = null;

      await updateAccountLabel();

      renderAccount(false);
    };
}


async function updateAccountLabel() {

  await getCurrentCustomer();

  if (!$('#accountLabel')) return;

  if (user) {

    $('#accountLabel').textContent =
      user.name
        .split(' ')[0];

  } else {

    $('#accountLabel').textContent =
      'My Account';
  }
}


/* =========================
   DEMO CHECKOUT
========================= */

function randomTicket() {

  return (
    'NX-' +
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()
  );
}


async function checkout() {

  cart = store.get(
    'nexa_cart',
    []
  );

  if (!cart.length) return;

  const authUser =
    await getCurrentCustomer();

  if (!authUser) {

    closeModals();

    await renderAccount(true);

    openModal(
      '#accountModal'
    );

    return;
  }

  const items = cart
    .map(item => {

      const c =
        competitions.find(
          x => x.id === item.id
        );

      if (!c) return null;

      return {
        ...item,
        title: c.title,
        price: c.price,
        tickets:
          Array.from(
            {
              length: item.qty
            },
            randomTicket
          )
      };

    })
    .filter(Boolean);

  if (!items.length) return;

  const total =
    items.reduce(
      (sum, item) =>
        sum +
        item.price * item.qty,
      0
    );

  const order = {
    id:
      'ORD-' +
      Date.now()
        .toString()
        .slice(-8),

    date:
      new Date()
        .toISOString(),

    userEmail:
      user.email,

    items,

    total,

    status:
      'DEMO — NOT PAID'
  };

  orders = store.get(
    'nexa_orders',
    []
  );

  orders.unshift(order);

  store.set(
    'nexa_orders',
    orders
  );

  store.set(
    'nexa_cart',
    []
  );

  cart = [];

  updateCartCount();

  closeModals();

  toast(
    `Demo order ${order.id} created`
  );

  await renderAccount(false);

  openModal(
    '#accountModal'
  );
}


/* =========================
   WINNERS
========================= */

function renderWinners() {

  winners = store.get(
    'nexa_winners',
    []
  );

  const winnerGrid =
    $('#winnerGrid');

  if (!winnerGrid) return;

  winnerGrid.innerHTML =
    winners.length

      ? winners.map(w => `
          <article class="winner-card">

            <span>🏆</span>

            <h3>
              ${escapeHtml(w.prize)}
            </h3>

            <p>
              Winner:
              <strong>
                ${escapeHtml(w.name)}
              </strong>
            </p>

            <small>
              ${
                new Date(w.date)
                  .toLocaleDateString(
                    'en-GB'
                  )
              }
            </small>

          </article>
        `).join('')

      : `
          <p class="empty">
            No winners have been published yet.
          </p>
        `;
}


function publishWinner(id) {

  const c = competitions.find(
    x => x.id === id
  );

  if (!c) return;

  const name = prompt(
    `Winner name for ${c.title}:`
  );

  if (!name) return;

  winners = store.get(
    'nexa_winners',
    []
  );

  winners.unshift({
    competitionId: c.id,
    prize: c.title,
    name,
    date:
      new Date()
        .toISOString()
  });

  store.set(
    'nexa_winners',
    winners
  );

  renderWinners();

  toast(
    'Winner published'
  );
}


/* =========================
   ADMIN AUTH
========================= */

async function openSecureAdmin() {

  let {
    data: { session }
  } =
    await supabaseClient.auth
      .getSession();


  if (!session) {

    const email =
      prompt('Admin email:');

    if (!email) return;

    const password =
      prompt('Admin password:');

    if (!password) return;


    const { data, error } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });


    if (error) {

      alert(
        'Admin login failed: ' +
        error.message
      );

      return;
    }

    session = data.session;
  }


  const uid =
    session?.user?.id;


  if (uid !== ADMIN_UID) {

    alert(
      'This account does not have administrator access.'
    );

    return;
  }


  adminView();

  openModal(
    '#adminModal'
  );
}


/* =========================
   ADMIN DASHBOARD
========================= */

function adminView(editId = '') {

  orders = store.get(
    'nexa_orders',
    []
  );

  winners = store.get(
    'nexa_winners',
    []
  );

  const edit =
    competitions.find(
      c => c.id === editId
    );


  $('#adminContent').innerHTML = `
    <p class="eyebrow">
      NEXA DRAW ADMIN
    </p>

    <h2>
      Competition Dashboard
    </h2>


    <div class="admin-stats">

      <div>
        <strong>
          ${competitions.length}
        </strong>
        <span>
          Competitions
        </span>
      </div>

      <div>
        <strong>
          ${orders.length}
        </strong>
        <span>
          Orders
        </span>
      </div>

      <div>
        <strong>
          ${winners.length}
        </strong>
        <span>
          Winners
        </span>
      </div>

    </div>


    <div class="admin-layout">

      <div>

        <h3>
          ${edit ? 'Edit' : 'Add'}
          competition
        </h3>

        <form id="competitionForm">

          <input
            type="hidden"
            name="existingId"
            value="${escapeHtml(edit?.id || '')}"
          >


          <label class="field">
            Title

            <input
              name="title"
              value="${escapeHtml(edit?.title || '')}"
              required
            >
          </label>


          <label class="field">
            Price

            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              value="${edit?.price ?? ''}"
              required
            >
          </label>


          <label class="field">
            Maximum entries

            <input
              name="max"
              type="number"
              min="1"
              value="${edit?.max ?? ''}"
              required
            >
          </label>


          <label class="field">
            Sold

            <input
              name="sold"
              type="number"
              min="0"
              value="${edit?.sold ?? 0}"
            >
          </label>


          <label class="field">
            Closing date

            <input
              name="closes"
              type="datetime-local"
              value="${
                edit?.closes
                  ? String(edit.closes)
                      .slice(0, 16)
                  : ''
              }"
              required
            >
          </label>


          <label class="field">
            Image path / URL

            <input
              name="image"
              value="${escapeHtml(edit?.image || '')}"
            >
          </label>


          <label class="field">
            Upload image

            <input
              name="image_file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            >
          </label>


          <label class="field">
            Description

            <textarea
              name="description"
            >${escapeHtml(edit?.description || '')}</textarea>
          </label>


          <label class="field">
            Skill Question

            <textarea
              name="skill_question"
              required
            >${escapeHtml(edit?.skill_question || '')}</textarea>
          </label>


          <label class="field">
            Option A

            <input
              name="skill_option_a"
              value="${escapeHtml(edit?.skill_option_a || '')}"
              required
            >
          </label>


          <label class="field">
            Option B

            <input
              name="skill_option_b"
              value="${escapeHtml(edit?.skill_option_b || '')}"
              required
            >
          </label>


          <label class="field">
            Option C

            <input
              name="skill_option_c"
              value="${escapeHtml(edit?.skill_option_c || '')}"
              required
            >
          </label>


          <label class="field">
            Correct Answer

            <select
              name="correct_answer"
              required
            >

              <option value="">
                Choose correct answer
              </option>

              <option value="A">
                Option A
              </option>

              <option value="B">
                Option B
              </option>

              <option value="C">
                Option C
              </option>

            </select>
          </label>


          <label class="field">
            Status

            <select name="status">

              <option
                value="live"
                ${
                  edit?.status === 'live'
                    ? 'selected'
                    : ''
                }
              >
                Live
              </option>

              <option
                value="paused"
                ${
                  edit?.status === 'paused'
                    ? 'selected'
                    : ''
                }
              >
                Paused
              </option>

            </select>
          </label>


          <button
            class="btn gold full"
            type="submit"
          >
            ${
              edit
                ? 'SAVE CHANGES'
                : 'ADD COMPETITION'
            }
          </button>

        </form>

      </div>


      <div>

        <h3>
          Manage draws
        </h3>

        <div class="admin-list">

          ${
            competitions.length

              ? competitions.map(c => `
                  <div class="admin-row">

                    <div>

                      <strong>
                        ${escapeHtml(c.title)}
                      </strong>

                      <small>
                        ${money(c.price)}
                        ·
                        ${c.sold}/${c.max}
                      </small>

                    </div>

                    <div>

                      <button
                        class="btn outline"
                        data-edit="${c.id}"
                      >
                        Edit
                      </button>

                      <button
                        class="btn outline"
                        data-winner="${c.id}"
                      >
                        Winner
                      </button>

                      <button
                        class="btn outline"
                        data-delete="${c.id}"
                      >
                        Delete
                      </button>

                    </div>

                  </div>
                `).join('')

              : `
                  <p class="empty">
                    No competitions.
                  </p>
                `
          }

        </div>

      </div>

    </div>
  `;


  $('#competitionForm').onsubmit =
    async e => {

      e.preventDefault();

      const f =
        new FormData(e.target);


      let imageUrl =
        f.get('image');


      const imageFile =
        f.get('image_file');


      if (
        imageFile &&
        imageFile.size
      ) {

        const ext =
          imageFile.name
            .split('.')
            .pop();


        const fileName =
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${ext}`;


        const {
          error: uploadError
        } =
          await supabaseClient.storage
            .from('competition-images')
            .upload(
              fileName,
              imageFile
            );


        if (uploadError) {

          alert(
            'Image upload failed: ' +
            uploadError.message
          );

          return;
        }


        const {
          data: publicData
        } =
          supabaseClient.storage
            .from('competition-images')
            .getPublicUrl(fileName);


        imageUrl =
          publicData.publicUrl;
      }


      const row = {

        title:
          f.get('title'),

        price:
          Number(f.get('price')),

        image_url:
          imageUrl,

        closes_at:
          f.get('closes'),

        max_entries:
          Number(f.get('max')),

        sold:
          Number(f.get('sold') || 0),

        status:
          f.get('status') || 'live',

        description:
          f.get('description') || '',

        skill_question:
          f.get('skill_question') || '',

        skill_option_a:
          f.get('skill_option_a') || '',

        skill_option_b:
          f.get('skill_option_b') || '',

        skill_option_c:
          f.get('skill_option_c') || ''
      };


      const existing =
        f.get('existingId');


      const correctChoice =
        f.get('correct_answer');


      const answerMap = {

        A:
          f.get('skill_option_a'),

        B:
          f.get('skill_option_b'),

        C:
          f.get('skill_option_c')
      };


      const correctAnswer =
        answerMap[correctChoice];


      if (!correctAnswer) {

        alert(
          'Please choose the correct answer.'
        );

        return;
      }


      let competitionId =
        existing;


      if (existing) {

        const { error } =
          await supabaseClient
            .from('competitions')
            .update(row)
            .eq(
              'id',
              existing
            );


        if (error) {

          alert(
            'Save failed: ' +
            error.message
          );

          return;
        }

      } else {

        const { data, error } =
          await supabaseClient
            .from('competitions')
            .insert(row)
            .select('id')
            .single();


        if (error) {

          alert(
            'Save failed: ' +
            error.message
          );

          return;
        }


        competitionId =
          data.id;
      }


      const {
        data: answerRow,
        error: answerLookupError
      } =
        await supabaseClient
          .from(
            'competition_skill_answers'
          )
          .select('competition_id')
          .eq(
            'competition_id',
            competitionId
          )
          .maybeSingle();


      if (answerLookupError) {

        alert(
          'Competition saved, but answer lookup failed: ' +
          answerLookupError.message
        );

        return;
      }


      let answerError = null;


      if (answerRow) {

        const { error } =
          await supabaseClient
            .from(
              'competition_skill_answers'
            )
            .update({
              correct_answer:
                correctAnswer
            })
            .eq(
              'competition_id',
              competitionId
            );


        answerError = error;

      } else {

        const { error } =
          await supabaseClient
            .from(
              'competition_skill_answers'
            )
            .insert({
              competition_id:
                competitionId,

              correct_answer:
                correctAnswer
            });


        answerError = error;
      }


      if (answerError) {

        alert(
          'Competition saved, but correct answer failed: ' +
          answerError.message
        );

        return;
      }


      await loadCompetitionsFromSupabase();

      adminView();

      alert(
        'Competition saved!'
      );
    };


  $$('[data-edit]').forEach(button => {

    button.onclick = () => {
      adminView(
        button.dataset.edit
      );
    };
  });


  $$('[data-delete]').forEach(button => {

    button.onclick = async () => {

      if (
        !confirm(
          'Delete this competition?'
        )
      ) {
        return;
      }


      const competitionId =
        button.dataset.delete;


      const {
        error: answerDeleteError
      } =
        await supabaseClient
          .from(
            'competition_skill_answers'
          )
          .delete()
          .eq(
            'competition_id',
            competitionId
          );


      if (answerDeleteError) {

        alert(
          'Delete failed: ' +
          answerDeleteError.message
        );

        return;
      }


      const { error } =
        await supabaseClient
          .from('competitions')
          .delete()
          .eq(
            'id',
            competitionId
          );


      if (error) {

        alert(
          'Delete failed: ' +
          error.message
        );

        return;
      }


      /*
        Remove deleted competition
        from the current browser basket.
      */

      cart = store
        .get('nexa_cart', [])
        .filter(
          item =>
            item.id !==
            competitionId
        );


      store.set(
        'nexa_cart',
        cart
      );


      updateCartCount();

      await loadCompetitionsFromSupabase();

      adminView();
    };
  });


  $$('[data-winner]').forEach(button => {

    button.onclick = () => {

      publishWinner(
        button.dataset.winner
      );
    };
  });
}


/* =========================
   LEGAL MODAL
========================= */

const legalPages = {

  terms: `
    <p class="eyebrow">
      LEGAL
    </p>

    <h2>
      Terms & Conditions
    </h2>

    <p>
      Draft terms placeholder.
      Final competition terms must be reviewed before launch.
    </p>
  `,

  privacy: `
    <p class="eyebrow">
      LEGAL
    </p>

    <h2>
      Privacy Policy
    </h2>

    <p>
      Draft privacy information placeholder.
      A complete privacy notice will be required before launch.
    </p>
  `,

  free: `
    <p class="eyebrow">
      LEGAL
    </p>

    <h2>
      Free Entry Route
    </h2>

    <p>
      Free-entry information will be published here where applicable.
    </p>
  `,

  responsible: `
    <p class="eyebrow">
      CUSTOMER CARE
    </p>

    <h2>
      Responsible Play
    </h2>

    <p>
      Responsible participation information,
      account controls and support information
      will be published here before launch.
    </p>
  `
};


function openLegal(type) {

  const content =
    legalPages[type];

  if (!content) return;

  $('#legalContent').innerHTML =
    content;

  openModal(
    '#legalModal'
  );
}


/* =========================
   BUTTON EVENTS
========================= */

if ($('#adminBtn')) {

  $('#adminBtn').onclick =
    openSecureAdmin;
}


if ($('#accountBtn')) {

  $('#accountBtn').onclick =
    async () => {

      await renderAccount(false);

      openModal(
        '#accountModal'
      );
    };
}


if ($('#cartBtn')) {

  $('#cartBtn').onclick =
    openCart;
}


if ($('#checkoutBtn')) {

  $('#checkoutBtn').onclick =
    checkout;
}


$$('[data-close]').forEach(button => {

  button.onclick =
    closeModals;
});


$$('[data-legal]').forEach(button => {

  button.onclick = () => {

    openLegal(
      button.dataset.legal
    );
  };
});


/* =========================
   AUTH EVENTS
========================= */

supabaseClient.auth
  .onAuthStateChange(
    async () => {

      await updateAccountLabel();
    }
  );


/* =========================
   START APP
========================= */

updateCartCount();
updateAccountLabel();
renderWinners();
loadCompetitionsFromSupabase();
