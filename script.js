'use strict';

/* =========================================================
   NEXA DRAW — CLEAN FRONT-END
   ========================================================= */

const SUPABASE_URL =
  'https://hkxegnjlxuscusygckqm.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_kO22Zj703int4nZp8ha9jg_hwgz5f9X';

const ADMIN_UID =
  '2b4b64c6-b96f-4b85-bce3-be28c141311e';

const PAYMENT_MODE = 'disabled';
const PAYMENT_PROVIDER = 'DNA Payments';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

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

if (!localStorage.getItem('nexa_cart')) {
  store.set('nexa_cart', []);
}

let competitions = [];
let cart = store.get('nexa_cart', []);
let user = null;
let checkoutPending = false;

/*
  Used when somebody tries to enter
  a free competition before logging in.
*/
let freeEntryPending = null;


/* =========================================================
   HELPERS
   ========================================================= */

function money(value) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(Number(value) || 0);
}

function isFreeCompetition(competition) {
  return Number(competition?.price || 0) === 0;
}

function competitionPriceLabel(competition) {
  return isFreeCompetition(competition)
    ? 'FREE ENTRY'
    : `${money(competition.price)} per entry`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);
}

function daysLeft(date) {
  if (!date) return 'CLOSING DATE TBC';

  const difference = Math.ceil(
    (new Date(date) - new Date()) / 86400000
  );

  if (difference > 0) {
    return `ENDS IN ${difference} DAY${difference === 1 ? '' : 'S'}`;
  }

  return 'CLOSED';
}

function formatDate(date) {
  if (!date) return '';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleDateString('en-GB');
}

function toast(message) {
  const element = $('#toast');

  if (!element) return;

  element.textContent = message;
  element.classList.add('show');

  setTimeout(() => {
    element.classList.remove('show');
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

async function isAdminSession() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  return session?.user?.id === ADMIN_UID;
}

async function functionErrorMessage(error, fallback) {
  try {
    const response = error?.context;

    if (response && typeof response.clone === 'function') {
      const body = await response.clone().json();

      if (body?.error) return body.error;
      if (body?.message) return body.message;
    }
  } catch {
    // Use fallback.
  }

  return fallback;
}


/* =========================================================
   COMPETITIONS
   ========================================================= */

async function loadCompetitionsFromSupabase() {
  const { data, error } = await supabaseClient
    .from('competitions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase competitions error:', error);
    toast('Could not load competitions');
    return;
  }

  competitions = (data || []).map(row => ({
    id: String(row.id),
    title: row.title || '',
    price: Number(row.price || 0),
    image: row.image_url || '',
    closes: row.closes_at || '',
    max: Number(row.max_entries || 0),
    sold: Number(row.sold || 0),
    status: row.status || 'live',
    description: row.description || '',
    skill_question: row.skill_question || '',
    skill_option_a: row.skill_option_a || '',
    skill_option_b: row.skill_option_b || '',
    skill_option_c: row.skill_option_c || ''
  }));

  renderDraws();
}

function renderDraws() {
  const host = $('#drawCards');

  if (!host) return;

  const live = competitions.filter(
    competition => competition.status === 'live'
  );

  if (!live.length) {
    host.innerHTML = `
      <p class="empty">No live competitions right now.</p>
    `;
    return;
  }

  host.innerHTML = live.map(competition => {
    const percentage = competition.max > 0
      ? Math.min(
          100,
          Math.round(
            (competition.sold / competition.max) * 100
          )
        )
      : 0;

    const free = isFreeCompetition(competition);

    return `
      <article
        class="card"
        data-id="${escapeHtml(competition.id)}"
      >
        <div class="card-img">
          <img
            src="${escapeHtml(competition.image)}"
            alt="${escapeHtml(competition.title)}"
          >

          <span>${daysLeft(competition.closes)}</span>
        </div>

        <div class="card-body">
          ${
            free
              ? `
                <p class="eyebrow">
                  FREE DRAW
                </p>
              `
              : ''
          }

          <h3>${escapeHtml(competition.title)}</h3>

          <p>
            ${
              free
                ? '<strong>FREE ENTRY</strong>'
                : `${money(competition.price)} per entry`
            }
          </p>

          <div class="bar">
            <i style="width:${percentage}%"></i>
          </div>

          <div class="stats">
            <b>${percentage}% entered</b>

            <span>
              ${competition.sold.toLocaleString()}
              /
              ${competition.max.toLocaleString()}
            </span>
          </div>

          <button
            class="enter"
            data-open-comp="${escapeHtml(competition.id)}"
          >
            ${
              free
                ? 'ENTER FREE DRAW'
                : 'ENTER NOW'
            }
          </button>
        </div>
      </article>
    `;
  }).join('');

  $$('[data-open-comp]').forEach(button => {
    button.onclick = () => {
      showCompetition(button.dataset.openComp);
    };
  });
}

function showCompetition(id) {
  const competition = competitions.find(
    item => item.id === String(id)
  );

  if (!competition) return;

  if (competition.status !== 'live') {
    toast('This competition is no longer available.');
    renderDraws();
    return;
  }

  const free = isFreeCompetition(competition);

  const remaining = Math.max(
    0,
    competition.max - competition.sold
  );

  const maximumChoice = Math.max(
    1,
    Math.min(100, remaining)
  );

  const content = $('#competitionContent');

  if (!content) return;

  content.innerHTML = `
    <div class="competition-detail">
      <img
        src="${escapeHtml(competition.image)}"
        alt="${escapeHtml(competition.title)}"
      >

      <div>
        <p class="eyebrow">
          ${
            free
              ? 'FREE DRAW'
              : 'LIVE COMPETITION'
          }
        </p>

        <h2>${escapeHtml(competition.title)}</h2>

        <p>
          ${escapeHtml(competition.description)}
        </p>

        <div class="detail-price">
          ${
            free
              ? 'FREE'
              : money(competition.price)
          }

          <small>
            ${
              free
                ? 'one free entry'
                : 'per entry'
            }
          </small>
        </div>

        <p>
          <strong>
            ${remaining.toLocaleString()}
          </strong>
          entries remaining
        </p>

        ${
          remaining > 0
            ? free
              ? `
                <p class="micro">
                  One free entry will be issued to your
                  Nexa account after you answer the
                  skill question correctly.
                </p>

                <button
                  class="btn gold full"
                  id="addToCart"
                >
                  ENTER FREE DRAW
                </button>
              `
              : `
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

        ${
          free
            ? `
              <p class="micro">
                No payment is required for this draw.
              </p>
            `
            : `
              <p class="micro">
                Secure payment processing is still
                in preparation.
              </p>
            `
        }
      </div>
    </div>
  `;

  $('#addToCart')?.addEventListener(
    'click',
    () => {
      openSkillQuestion(competition.id);
    }
  );

  openModal('#competitionModal');
}


/* =========================================================
   SKILL QUESTION
   ========================================================= */

function openSkillQuestion(id) {
  const competition = competitions.find(
    item => item.id === String(id)
  );

  if (!competition) return;

  if (competition.status !== 'live') {
    toast('This competition is no longer available.');
    return;
  }

  const free = isFreeCompetition(competition);

  const remaining = Math.max(
    0,
    competition.max - competition.sold
  );

  const quantity = free
    ? 1
    : Math.max(
        1,
        Math.min(
          100,
          remaining,
          Number($('#entryQty')?.value) || 1
        )
      );

  const question = $('#skillQuestion');
  const answers = $('#skillAnswers');
  const errorHost = $('#skillError');

  if (!question || !answers || !errorHost) {
    return;
  }

  question.textContent =
    competition.skill_question ||
    'Skill question unavailable.';

  errorHost.textContent = '';
  answers.innerHTML = '';

  [
    competition.skill_option_a,
    competition.skill_option_b,
    competition.skill_option_c
  ]
    .filter(Boolean)
    .forEach(option => {
      const button = document.createElement('button');

      button.className = 'btn outline full';
      button.type = 'button';
      button.dataset.skill = option;
      button.textContent = option;

      answers.appendChild(button);
    });

  $$('[data-skill]').forEach(button => {
    button.onclick = async () => {
      errorHost.textContent = 'Checking answer...';

      $$('[data-skill]').forEach(item => {
        item.disabled = true;
      });

      const { data, error } =
        await supabaseClient.functions.invoke(
          'check-skill-answer',
          {
            body: {
              competition_id: competition.id,
              answer: button.dataset.skill
            }
          }
        );

      $$('[data-skill]').forEach(item => {
        item.disabled = false;
      });

      if (error) {
        console.error(
          'Skill answer check failed:',
          error
        );

        errorHost.textContent =
          'Unable to check your answer. Please try again.';

        return;
      }

      if (!data?.correct) {
        errorHost.textContent =
          'Incorrect answer. Please try again.';

        return;
      }

      /*
        FREE DRAW:
        DO NOT ADD TO BASKET.
        CREATE SECURE FREE ENTRY.
      */
      if (free) {
        closeModals();

        await enterFreeCompetition(
          competition.id
        );

        return;
      }

      /*
        NORMAL PAID COMPETITION.
      */
      addToCart(
        competition.id,
        quantity
      );

      closeModals();
      openCart();
    };
  });

  closeModals();
  openModal('#skillModal');
}


/* =========================================================
   FREE COMPETITION ENTRY
   ========================================================= */

async function enterFreeCompetition(id) {
  const competition = competitions.find(
    item => item.id === String(id)
  );

  if (!competition) {
    alert('Competition could not be found.');
    return;
  }

  if (competition.status !== 'live') {
    toast('This competition is no longer available.');
    return;
  }

  if (!isFreeCompetition(competition)) {
    alert(
      'This is not a free competition.'
    );
    return;
  }

  const remaining = Math.max(
    0,
    competition.max - competition.sold
  );

  if (remaining <= 0) {
    toast('This free draw is full.');
    return;
  }

  const customer =
    await getCurrentCustomer();

  /*
    USER MUST HAVE AN ACCOUNT.
  */
  if (!customer) {
    freeEntryPending = competition.id;

    closeModals();

    await renderAccount(true);

    openModal('#accountModal');

    toast(
      'Log in or create an account to receive your free ticket'
    );

    return;
  }

  /*
    SECURE SERVER-SIDE FREE ENTRY.

    The Supabase Edge Function should:
    - verify the logged-in user
    - verify competition is live
    - verify price = 0
    - prevent duplicate free entry if desired
    - create the order/entry
    - create the ticket number
    - increase sold count
    - return the ticket number
  */
  const { data, error } =
    await supabaseClient.functions.invoke(
      'create-free-entry-v2',
      {
        body: {
          competition_id: competition.id
        }
      }
    );

  if (error) {
    console.error(
      'Free entry error:',
      error
    );

    alert(
      await functionErrorMessage(
        error,
        'Your free entry could not be created.'
      )
    );

    return;
  }

  if (!data?.success) {
    alert(
      data?.error ||
      data?.message ||
      'Your free entry could not be created.'
    );

    return;
  }

  freeEntryPending = null;

  await loadCompetitionsFromSupabase();

  const ticketNumber =
    data?.ticket?.ticket_number ||
    data?.ticket_number ||
    '';

  if (ticketNumber) {
    alert(
      `You're entered!\n\n` +
      `Competition: ${competition.title}\n` +
      `Ticket number: ${ticketNumber}\n\n` +
      `Your ticket is saved in My Account.`
    );
  } else {
    alert(
      `You're entered into "${competition.title}".\n\n` +
      'Your entry has been saved to your Nexa account.'
    );
  }

  toast('Free entry confirmed');

  /*
    OPEN CUSTOMER ACCOUNT SO THEY CAN
    SEE THEIR TICKET.
  */
  await renderAccount(false);
  openModal('#accountModal');
}


/* =========================================================
   BASKET
   ========================================================= */

function addToCart(id, quantity) {
  cart = store.get('nexa_cart', []);

  const competition = competitions.find(
    item => item.id === String(id)
  );

  if (!competition) return;

  if (competition.status !== 'live') {
    toast('This competition is no longer available.');
    return;
  }

  /*
    FREE COMPETITIONS NEVER GO INTO CART.
  */
  if (isFreeCompetition(competition)) {
    enterFreeCompetition(competition.id);
    return;
  }

  const remaining = Math.max(
    0,
    competition.max - competition.sold
  );

  if (remaining <= 0) {
    toast(
      'No entries remaining for this competition.'
    );
    return;
  }

  quantity = Math.max(
    1,
    Math.min(
      Number(quantity) || 1,
      100,
      remaining
    )
  );

  const found = cart.find(
    item => item.id === String(id)
  );

  if (found) {
    found.qty = Math.min(
      Number(found.qty || 0) + quantity,
      100,
      remaining
    );
  } else {
    cart.push({
      id: String(id),
      qty: quantity
    });
  }

  store.set('nexa_cart', cart);
  updateCartCount();

  toast('Entries added to your basket');
}

function updateCartCount() {
  cart = store.get('nexa_cart', []);

  const count = cart.reduce(
    (total, item) =>
      total + Number(item.qty || 0),
    0
  );

  const countHost = $('#cartCount');

  if (countHost) {
    countHost.textContent = count;
  }
}

function openCart() {
  /*
    ONLY PAID, LIVE COMPETITIONS
    BELONG IN THE BASKET.
  */
  cart = store.get('nexa_cart', []).filter(
    item =>
      competitions.some(
        competition =>
          competition.id === String(item.id) &&
          competition.status === 'live' &&
          !isFreeCompetition(competition)
      )
  );

  store.set('nexa_cart', cart);

  updateCartCount();

  let total = 0;

  const host = $('#cartItems');

  if (!host) return;

  host.innerHTML = cart.length
    ? cart.map((item, index) => {
        const competition = competitions.find(
          competition =>
            competition.id === String(item.id) &&
            competition.status === 'live' &&
            !isFreeCompetition(competition)
        );

        if (!competition) return '';

        const lineTotal =
          competition.price *
          Number(item.qty || 0);

        total += lineTotal;

        return `
          <div class="cart-line">
            <div>
              <strong>
                ${escapeHtml(competition.title)}
              </strong>

              <small>
                ${item.qty} ×
                ${money(competition.price)}
              </small>
            </div>

            <div>
              <b>${money(lineTotal)}</b>

              <button
                class="remove"
                data-remove="${index}"
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

  const totalHost = $('#cartTotal');

  if (totalHost) {
    totalHost.textContent = money(total);
  }

  $$('[data-remove]').forEach(button => {
    button.onclick = () => {
      cart.splice(
        Number(button.dataset.remove),
        1
      );

      store.set('nexa_cart', cart);

      updateCartCount();
      openCart();
    };
  });

  const checkoutButton = $('#checkoutBtn');

  if (checkoutButton) {
    checkoutButton.disabled = !cart.length;

    checkoutButton.textContent =
      PAYMENT_MODE === 'live'
        ? 'SECURE CHECKOUT'
        : 'CHECKOUT — COMING SOON';
  }

  const micro =
    $('#cartModal .micro');

  if (micro) {
    micro.innerHTML =
      PAYMENT_MODE === 'live'
        ? `Secure payment powered by ${escapeHtml(PAYMENT_PROVIDER)}.`
        : 'Payment setup is being prepared. No card or wallet can be charged yet.';
  }

  openModal('#cartModal');
}


/* =========================================================
   CUSTOMER ACCOUNT
   ========================================================= */

async function getCurrentCustomer() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  const authUser =
    session?.user || null;

  if (!authUser) {
    user = null;
    return null;
  }

  user = {
    id: authUser.id,
    email: authUser.email || '',
    name:
      authUser.user_metadata?.name ||
      'Customer'
  };

  return user;
}

async function loadCustomerOrders(customer) {
  const {
    data: orderRows,
    error: orderError
  } = await supabaseClient
    .from('orders')
    .select(
      'id,total,status,created_at,paid_at,payment_provider,payment_reference'
    )
    .eq('user_id', customer.id)
    .order('created_at', {
      ascending: false
    });

  if (orderError) {
    console.error(
      'Customer orders error:',
      orderError
    );

    return {
      orders: [],
      error: orderError.message
    };
  }

  const orders = orderRows || [];

  if (!orders.length) {
    return {
      orders: [],
      error: null
    };
  }

  const orderIds =
    orders.map(order => order.id);

  const {
    data: ticketRows,
    error: ticketError
  } = await supabaseClient
    .from('tickets')
    .select(
      'id,order_id,competition_id,ticket_number,status,created_at'
    )
    .in('order_id', orderIds)
    .order('id', {
      ascending: true
    });

  if (ticketError) {
    console.error(
      'Customer tickets error:',
      ticketError
    );
  }

  const tickets =
    ticketRows || [];

  return {
    error:
      ticketError
        ? ticketError.message
        : null,

    orders: orders.map(order => ({
      ...order,

      tickets: tickets.filter(
        ticket =>
          ticket.order_id === order.id
      )
    }))
  };
}

function customerOrderCard(order) {
  const date = formatDate(
    order.paid_at ||
    order.created_at
  );

  const status = String(
    order.status || 'pending'
  );

  const total =
    Number(order.total || 0);

  let statusLabel;

  if (total === 0) {
    statusLabel = 'FREE ENTRY';
  } else if (status === 'paid') {
    statusLabel = 'PAID';
  } else {
    statusLabel =
      status.toUpperCase();
  }

  const tickets =
    order.tickets || [];

  const ticketsHtml =
    tickets.length
      ? tickets.map(ticket => {
          const competition =
            competitions.find(
              item =>
                item.id ===
                String(
                  ticket.competition_id
                )
            );

          return `
            <div class="ticket-line">
              <p>
                ${
                  competition
                    ? escapeHtml(
                        competition.title
                      )
                    : 'Competition'
                }
              </p>

              <p>
                Ticket:
                <strong>
                  ${escapeHtml(
                    ticket.ticket_number
                  )}
                </strong>
              </p>
            </div>
          `;
        }).join('')
      : `
          <p class="empty">
            No tickets found for this entry.
          </p>
        `;

  return `
    <div class="order-card">
      <strong>
        ${
          total === 0
            ? 'Free Entry'
            : `Order ${escapeHtml(order.id)}`
        }
      </strong>

      <p>
        ${
          total === 0
            ? 'FREE'
            : money(total)
        }
      </p>

      <small>
        ${escapeHtml(statusLabel)}
        ${
          date
            ? ` · ${escapeHtml(date)}`
            : ''
        }
      </small>

      <details>
        <summary>
          View ticket
        </summary>

        ${ticketsHtml}
      </details>
    </div>
  `;
}

async function renderAccount(
  fromCheckout = false
) {
  await getCurrentCustomer();

  const host = $('#accountContent');

  if (!host) return;

  if (!user) {
    host.innerHTML = `
      <p class="eyebrow">
        MY NEXA
      </p>

      <h2>
        ${
          fromCheckout
            ? 'Sign in to continue'
            : 'Customer Account'
        }
      </h2>

      <h3>
        Create Account
      </h3>

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
      async event => {
        event.preventDefault();

        const formData =
          new FormData(event.target);

        const { error } =
          await supabaseClient.auth.signUp({
            email: String(
              formData.get('email') || ''
            ).trim(),

            password: String(
              formData.get('password') || ''
            ),

            options: {
              data: {
                name: String(
                  formData.get('name') || ''
                ).trim()
              },

              emailRedirectTo:
                window.location.origin + '/'
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
          'Account created. Please check your email if confirmation is required.'
        );
      };

    $('#loginForm').onsubmit =
      async event => {
        event.preventDefault();

        const formData =
          new FormData(event.target);

        const { error } =
          await supabaseClient.auth
            .signInWithPassword({
              email: String(
                formData.get('email') || ''
              ).trim(),

              password: String(
                formData.get('password') || ''
              )
            });

        if (error) {
          alert(
            'Login failed: ' +
            error.message
          );

          return;
        }

        await updateAccountLabel();

        /*
          FREE DRAW WAS WAITING
          FOR LOGIN.
        */
        if (freeEntryPending) {
          const pendingCompetition =
            freeEntryPending;

          freeEntryPending = null;

          closeModals();

          await enterFreeCompetition(
            pendingCompetition
          );

          return;
        }

        if (checkoutPending) {
          checkoutPending = false;

          closeModals();

          openCart();

          toast(
            'Logged in — you can continue checkout'
          );

          return;
        }

        await renderAccount(false);
      };

    return;
  }

  host.innerHTML = `
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

    <h3>
      Your entries & orders
    </h3>

    <p class="empty">
      Loading your entries...
    </p>

    <button
      class="btn outline full"
      id="logoutBtn"
    >
      LOG OUT
    </button>
  `;

  const {
    orders,
    error
  } =
    await loadCustomerOrders(user);

  const orderSection =
    orders.length
      ? orders
          .map(customerOrderCard)
          .join('')
      : `
          <p class="empty">
            ${
              error
                ? 'Your entries could not be loaded. Please try again.'
                : 'No entries yet.'
            }
          </p>
        `;

  host.innerHTML = `
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

    <h3>
      Your entries & orders
    </h3>

    ${orderSection}

    <button
      class="btn outline full"
      id="logoutBtn"
    >
      LOG OUT
    </button>
  `;

  $('#logoutBtn').onclick =
    async () => {
      await supabaseClient.auth.signOut();

      user = null;
      checkoutPending = false;
      freeEntryPending = null;

      await updateAccountLabel();
      await renderAccount(false);
    };
}

async function updateAccountLabel() {
  await getCurrentCustomer();

  const label =
    $('#accountLabel');

  if (!label) return;

  label.textContent = user
    ? (user.name || 'Customer')
        .split(' ')[0]
    : 'My Account';
}


/* =========================================================
   CHECKOUT
   ========================================================= */

async function checkout() {
  /*
    FREE COMPETITIONS ARE NOT
    SENT THROUGH CHECKOUT.
  */
  cart = store
    .get('nexa_cart', [])
    .filter(
      item =>
        competitions.some(
          competition =>
            competition.id ===
              String(item.id) &&
            competition.status ===
              'live' &&
            !isFreeCompetition(
              competition
            )
        )
    );

  store.set('nexa_cart', cart);
  updateCartCount();

  if (!cart.length) {
    toast(
      'Your basket has no paid competitions.'
    );

    return;
  }

  const authUser =
    await getCurrentCustomer();

  if (!authUser) {
    checkoutPending = true;

    closeModals();

    await renderAccount(true);

    openModal('#accountModal');

    return;
  }

  if (PAYMENT_MODE !== 'live') {
    const items =
      cart.map(item => ({
        competition_id:
          Number(item.id),

        quantity:
          Number(item.qty)
      }));

    const { data, error } =
      await supabaseClient.functions.invoke(
        'create-order',
        {
          body: { items }
        }
      );

    if (error) {
      console.error(
        'Create order error:',
        error
      );

      alert(
        await functionErrorMessage(
          error,
          'The secure order could not be created.'
        )
      );

      return;
    }

    if (!data?.success) {
      alert(
        data?.error ||
        'The secure order could not be created.'
      );

      return;
    }

    const cartItems =
      $('#cartItems');

    if (
      cartItems &&
      !$('#paymentNotice')
    ) {
      cartItems.insertAdjacentHTML(
        'afterbegin',
        `
          <div
            class="order-card"
            id="paymentNotice"
          >
            <strong>
              Secure test order created
            </strong>

            <p>
              Order total:
              £${Number(
                data.order.total
              ).toFixed(2)}
            </p>

            <p class="micro">
              No payment has been taken.
              No tickets have been issued.
            </p>
          </div>
        `
      );
    }

    toast(
      'Secure test order created'
    );

    return;
  }

  alert(
    'Payment backend is not connected yet.'
  );
}


/* =========================================================
   WINNERS
   ========================================================= */

async function renderWinners() {
  const host =
    $('#winnerGrid');

  if (!host) return;

  const { data, error } =
    await supabaseClient.rpc(
      'get_public_winners'
    );

  if (error) {
    console.error(
      'Public winners error:',
      error
    );

    host.innerHTML = `
      <p class="empty">
        Winners could not be loaded.
      </p>
    `;

    return;
  }

  const publicWinners =
    Array.isArray(data)
      ? data
      : [];

  host.innerHTML =
    publicWinners.length
      ? publicWinners.map(
          winner => `
            <article class="winner-card">
              <span>🏆</span>

              <h3>
                ${escapeHtml(
                  winner.prize
                )}
              </h3>

              <p>
  Winner:
  <strong>
    ${escapeHtml(
      winner.winner_name || 'Winner'
    )}
  </strong>
</p>

              <p>
                Ticket:
                <strong>
                  ${escapeHtml(
                    winner.ticket_number
                  )}
                </strong>
              </p>

              <small>
                ${formatDate(
                  winner.drawn_at
                )}
              </small>
            </article>
          `
        ).join('')
      : `
          <p class="empty">
            No winners have been published yet.
          </p>
        `;
}


/* =========================================================
   SECURE WINNER DRAW
   ========================================================= */

async function drawWinnerSecurely(id) {
  if (!(await isAdminSession())) {
    alert(
      'Administrator access required.'
    );

    return;
  }

  const competition =
    competitions.find(
      item =>
        item.id === String(id)
    );

  if (!competition) return;

  const confirmed =
    window.confirm(
      `Draw a winner for "${competition.title}"?\n\n` +
      'Only eligible issued tickets should be included. ' +
      'The winner must be selected by the secure server-side draw function.'
    );

  if (!confirmed) return;

  const { data, error } =
    await supabaseClient.functions.invoke(
      'draw-winner',
      {
        body: {
          competition_id:
            competition.id
        }
      }
    );

  if (error) {
    console.error(
      'Winner draw error:',
      error
    );

    alert(
      await functionErrorMessage(
        error,
        'Secure winner draw failed. No new winner has been selected.'
      )
    );

    return;
  }

  if (!data?.winner) {
    alert(
      data?.message ||
      'No eligible tickets were found.'
    );

    return;
  }

  await renderWinners();

  await loadCompetitionsFromSupabase();

  toast(
    'Winner drawn and published'
  );

  await adminView();
}


/* =========================================================
   ADMIN
   ========================================================= */
async function loadAdminWinners() {
  if (!(await isAdminSession())) {
    return [];
  }

  const { data, error } =
    await supabaseClient.rpc(
      'get_admin_winners'
    );

  if (error) {
    console.error(
      'Admin winners error:',
      error
    );

    return [];
  }

  return Array.isArray(data)
    ? data
    : [];
}
async function openSecureAdmin() {
  closeModals();

  const host =
    $('#adminContent');

  if (!host) return;

  if (await isAdminSession()) {
    await adminView();

    openModal('#adminModal');

    return;
  }

  host.innerHTML = `
    <p class="eyebrow">
      NEXA DRAW
    </p>

    <h2>
      Administrator
    </h2>

    <form id="adminLoginForm">
      <label class="field">
        Email

        <input
          name="email"
          type="email"
          autocomplete="email"
          required
        >
      </label>

      <label class="field">
        Password

        <input
          name="password"
          type="password"
          autocomplete="current-password"
          required
        >
      </label>

      <button
        class="btn gold full"
        type="submit"
      >
        ADMIN LOG IN
      </button>
    </form>
  `;

  openModal('#adminModal');

  $('#adminLoginForm').onsubmit =
    async event => {
      event.preventDefault();

      const formData =
        new FormData(event.target);

      const { data, error } =
        await supabaseClient.auth
          .signInWithPassword({
            email: String(
              formData.get('email') || ''
            ).trim(),

            password: String(
              formData.get('password') || ''
            )
          });

      if (error) {
        alert(
          'Admin login failed: ' +
          error.message
        );

        return;
      }

      if (
        data?.user?.id !== ADMIN_UID
      ) {
        await supabaseClient.auth
          .signOut();

        alert(
          'Administrator access required.'
        );

        return;
      }

      await updateAccountLabel();

      await adminView();
    };
}

async function getCorrectAnswerLetter(
  competition
) {
  if (!competition?.id) return 'A';

  const { data, error } =
    await supabaseClient
      .from(
        'competition_skill_answers'
      )
      .select('correct_answer')
      .eq(
        'competition_id',
        competition.id
      )
      .maybeSingle();

  if (
    error ||
    !data?.correct_answer
  ) {
    return 'A';
  }

  const answer =
    String(data.correct_answer);

  if (
    answer ===
    competition.skill_option_b
  ) {
    return 'B';
  }

  if (
    answer ===
    competition.skill_option_c
  ) {
    return 'C';
  }

  return 'A';
}

async function adminView(
  editId = null
) {
  if (!(await isAdminSession())) {
    const host =
      $('#adminContent');

    if (host) {
      host.innerHTML = `
        <p class="empty">
          Administrator access required.
        </p>
      `;
    }

    return;
  }

  await loadCompetitionsFromSupabase();

  const edit =
    editId
      ? competitions.find(
          item =>
            item.id ===
            String(editId)
        )
      : null;

  const selectedCorrect =
    edit
      ? await getCorrectAnswerLetter(
          edit
        )
      : 'A';

  const host =
    $('#adminContent');

  if (!host) return;

  host.innerHTML = `
    <div class="admin-head">
      <div>
        <p class="eyebrow">
          NEXA DRAW
        </p>

        <h2>
          Admin Dashboard
        </h2>
      </div>

      <button
        class="btn outline"
        id="adminLogout"
      >
        LOG OUT
      </button>
    </div>

    <div class="admin-grid">
      <div>
        <h3>
          ${
            edit
              ? 'Edit competition'
              : 'Add competition'
          }
        </h3>

        <form id="competitionForm">
          <input
            type="hidden"
            name="id"
            value="${escapeHtml(
              edit?.id || ''
            )}"
          >

          <label class="field">
            Title

            <input
              name="title"
              required
              value="${escapeHtml(
                edit?.title || ''
              )}"
            >
          </label>

          <label class="field">
            Price

            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              value="${escapeHtml(
                edit?.price ?? ''
              )}"
            >

            <small>
              Enter 0.00 to create a
              FREE DRAW.
            </small>
          </label>

          <label class="field">
            Maximum entries

            <input
              name="max_entries"
              type="number"
              min="1"
              step="1"
              required
              value="${escapeHtml(
                edit?.max ?? ''
              )}"
            >
          </label>

          <label class="field">
            Closing date

            <input
              name="closes_at"
              type="datetime-local"
              value="${escapeHtml(
                edit?.closes
                  ? new Date(
                      edit.closes
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ''
              )}"
            >
          </label>

          <label class="field">
            Description

            <textarea
              name="description"
              rows="4"
            >${escapeHtml(
              edit?.description || ''
            )}</textarea>
          </label>

          <label class="field">
            Competition image

            <input
              name="image"
              type="file"
              accept="image/*"
            >
          </label>

          ${
            edit?.image
              ? `
                <p class="micro">
                  Current image is already saved.
                  Upload another image only
                  to replace it.
                </p>
              `
              : ''
          }

          <label class="field">
            Skill question

            <input
              name="skill_question"
              required
              value="${escapeHtml(
                edit?.skill_question || ''
              )}"
            >
          </label>

          <label class="field">
            Option A

            <input
              name="skill_option_a"
              required
              value="${escapeHtml(
                edit?.skill_option_a || ''
              )}"
            >
          </label>

          <label class="field">
            Option B

            <input
              name="skill_option_b"
              required
              value="${escapeHtml(
                edit?.skill_option_b || ''
              )}"
            >
          </label>

          <label class="field">
            Option C

            <input
              name="skill_option_c"
              required
              value="${escapeHtml(
                edit?.skill_option_c || ''
              )}"
            >
          </label>

          <label class="field">
            Correct answer

            <select
              name="correct_answer_letter"
              required
            >
              <option
                value="A"
                ${
                  selectedCorrect === 'A'
                    ? 'selected'
                    : ''
                }
              >
                Option A
              </option>

              <option
                value="B"
                ${
                  selectedCorrect === 'B'
                    ? 'selected'
                    : ''
                }
              >
                Option B
              </option>

              <option
                value="C"
                ${
                  selectedCorrect === 'C'
                    ? 'selected'
                    : ''
                }
              >
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

              <option
                value="closed"
                ${
                  edit?.status === 'closed'
                    ? 'selected'
                    : ''
                }
              >
                Closed
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
              ? competitions.map(
                  competition => `
                    <div class="admin-row">
                      <div>
                        <strong>
                          ${escapeHtml(
                            competition.title
                          )}
                        </strong>

                        <small>
                          ${
                            isFreeCompetition(
                              competition
                            )
                              ? 'FREE'
                              : money(
                                  competition.price
                                )
                          }

                          ·

                          ${competition.sold}
                          /
                          ${competition.max}

                          ·

                          ${escapeHtml(
                            String(
                              competition.status ||
                              'live'
                            ).toUpperCase()
                          )}
                        </small>
                      </div>

                      <div>
                        <button
                          class="btn outline"
                          data-edit="${competition.id}"
                        >
                          Edit
                        </button>

                        <button
                          class="btn outline"
                          data-winner="${competition.id}"
                        >
                          Draw Winner
                        </button>

                        <button
                          class="btn outline"
                          data-close-competition="${competition.id}"
                          ${
                            competition.status ===
                            'closed'
                              ? 'disabled'
                              : ''
                          }
                        >
                          ${
                            competition.status ===
                            'closed'
                              ? 'Closed'
                              : 'Close Competition'
                          }
                        </button>
                      </div>
                    </div>
                  `
                ).join('')
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

  $('#adminLogout').onclick =
    async () => {
      await supabaseClient.auth.signOut();

      closeModals();

      await updateAccountLabel();

      toast(
        'Admin logged out'
      );
    };

  $('#competitionForm').onsubmit =
    saveCompetition;

  $$('[data-edit]').forEach(
    button => {
      button.onclick =
        () =>
          adminView(
            button.dataset.edit
          );
    }
  );

  $$(
    '[data-close-competition]'
  ).forEach(button => {
    button.onclick =
      () =>
        closeCompetition(
          button.dataset
            .closeCompetition
        );
  });

  $$('[data-winner]').forEach(
    button => {
      button.onclick =
        () =>
          drawWinnerSecurely(
            button.dataset.winner
          );
    }
  );
}


/* =========================================================
   ADMIN IMAGE / SAVE
   ========================================================= */

async function uploadCompetitionImage(
  file
) {
  if (!file || !file.size) {
    return '';
  }

  const extension = (
    file.name
      .split('.')
      .pop() || 'jpg'
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ''
    ) || 'jpg';

  const path =
    `${ADMIN_UID}/` +
    `${Date.now()}-` +
    `${crypto.randomUUID()}.` +
    `${extension}`;

  const { error } =
    await supabaseClient.storage
      .from(
        'competition-images'
      )
      .upload(
        path,
        file,
        {
          cacheControl: '3600',
          upsert: false
        }
      );

  if (error) throw error;

  const { data } =
    supabaseClient.storage
      .from(
        'competition-images'
      )
      .getPublicUrl(path);

  return data?.publicUrl || '';
}

async function saveCompetition(
  event
) {
  event.preventDefault();

  if (!(await isAdminSession())) {
    alert(
      'Administrator access required.'
    );

    return;
  }

  const formData =
    new FormData(event.target);

  const existingId =
    String(
      formData.get('id') || ''
    ).trim();

  const existing =
    existingId
      ? competitions.find(
          item =>
            item.id ===
            existingId
        )
      : null;

  const title =
    String(
      formData.get('title') || ''
    ).trim();

  const price =
    Number(
      formData.get('price')
    );

  const maxEntries =
    Number(
      formData.get(
        'max_entries'
      )
    );

  const closesInput =
    String(
      formData.get(
        'closes_at'
      ) || ''
    ).trim();

  const description =
    String(
      formData.get(
        'description'
      ) || ''
    ).trim();

  const skillQuestion =
    String(
      formData.get(
        'skill_question'
      ) || ''
    ).trim();

  const optionA =
    String(
      formData.get(
        'skill_option_a'
      ) || ''
    ).trim();

  const optionB =
    String(
      formData.get(
        'skill_option_b'
      ) || ''
    ).trim();

  const optionC =
    String(
      formData.get(
        'skill_option_c'
      ) || ''
    ).trim();

  const correctLetter =
    String(
      formData.get(
        'correct_answer_letter'
      ) || 'A'
    );

  const status =
    String(
      formData.get('status') ||
      'live'
    );

  if (
    !title ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(
      maxEntries
    ) ||
    maxEntries < 1 ||
    !skillQuestion ||
    !optionA ||
    !optionB ||
    !optionC
  ) {
    alert(
      'Please complete all required competition fields.'
    );

    return;
  }

  let imageUrl =
    existing?.image || '';

  const imageFile =
    formData.get('image');

  if (
    imageFile instanceof File &&
    imageFile.size
  ) {
    try {
      imageUrl =
        await uploadCompetitionImage(
          imageFile
        );
    } catch (error) {
      alert(
        'Image upload failed: ' +
        (
          error?.message ||
          'Unknown error'
        )
      );

      return;
    }
  }

  if (!imageUrl) {
    alert(
      'Please upload a competition image.'
    );

    return;
  }

  const payload = {
    title,
    price,
    image_url: imageUrl,

    closes_at:
      closesInput
        ? new Date(
            closesInput
          ).toISOString()
        : null,

    max_entries: maxEntries,
    status,
    description,
    skill_question:
      skillQuestion,
    skill_option_a:
      optionA,
    skill_option_b:
      optionB,
    skill_option_c:
      optionC
  };

  let competitionId =
    existingId;

  if (existingId) {
    const { error } =
      await supabaseClient
        .from('competitions')
        .update(payload)
        .eq(
          'id',
          existingId
        );

    if (error) {
      alert(
        'Competition save failed: ' +
        error.message
      );

      return;
    }
  } else {
    const { data, error } =
      await supabaseClient
        .from('competitions')
        .insert(payload)
        .select('id')
        .single();

    if (error) {
      alert(
        'Competition save failed: ' +
        error.message
      );

      return;
    }

    competitionId =
      String(data.id);
  }

  const correctAnswer =
    correctLetter === 'B'
      ? optionB
      : correctLetter === 'C'
        ? optionC
        : optionA;

  const {
    data: existingAnswer,
    error: lookupError
  } = await supabaseClient
    .from(
      'competition_skill_answers'
    )
    .select('competition_id')
    .eq(
      'competition_id',
      competitionId
    )
    .maybeSingle();

  if (lookupError) {
    alert(
      'Competition saved, but private answer lookup failed: ' +
      lookupError.message
    );

    return;
  }

  if (existingAnswer) {
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

    if (error) {
      alert(
        'Competition saved, but private answer update failed: ' +
        error.message
      );

      return;
    }
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

    if (error) {
      alert(
        'Competition saved, but private answer save failed: ' +
        error.message
      );

      return;
    }
  }

  await loadCompetitionsFromSupabase();

  await adminView();

  toast(
    existingId
      ? 'Competition updated'
      : isFreeCompetition({
          price
        })
        ? 'Free competition added'
        : 'Competition added'
  );
}


/* =========================================================
   CLOSE COMPETITION
   ========================================================= */

async function closeCompetition(id) {
  if (!(await isAdminSession())) {
    alert(
      'Administrator access required.'
    );

    return;
  }

  const competition =
    competitions.find(
      item =>
        item.id === String(id)
    );

  if (!competition) return;

  if (
    competition.status ===
    'closed'
  ) {
    toast(
      'Competition is already closed'
    );

    return;
  }

  const confirmed =
    window.confirm(
      `Close "${competition.title}"?\n\n` +
      'This will remove the competition from the main website.\n\n' +
      'The competition record, image, entries, orders, tickets and other saved data will NOT be deleted.'
    );

  if (!confirmed) return;

  const { error } =
    await supabaseClient
      .from('competitions')
      .update({
        status: 'closed'
      })
      .eq('id', id);

  if (error) {
    console.error(
      'Close competition error:',
      error
    );

    alert(
      'Could not close competition: ' +
      error.message
    );

    return;
  }

  cart =
    store
      .get('nexa_cart', [])
      .filter(
        item =>
          item.id !== String(id)
      );

  store.set(
    'nexa_cart',
    cart
  );

  updateCartCount();

  await loadCompetitionsFromSupabase();

  await adminView();

  toast(
    'Competition closed'
  );
}


/* =========================================================
   DELETE COMPETITION
   ========================================================= */

/*
  NO DELETE BUTTON IS SHOWN IN ADMIN.

  This function remains available
  internally only.

  Normal admin use should close
  competitions instead.
*/

async function deleteCompetition(id) {
  if (!(await isAdminSession())) {
    alert(
      'Administrator access required.'
    );

    return;
  }

  const competition =
    competitions.find(
      item =>
        item.id === String(id)
    );

  if (!competition) return;

  if (
    !confirm(
      `Delete "${competition.title}"?`
    )
  ) {
    return;
  }

  const { error: answerError } =
    await supabaseClient
      .from(
        'competition_skill_answers'
      )
      .delete()
      .eq(
        'competition_id',
        id
      );

  if (answerError) {
    alert(
      'Delete failed: ' +
      answerError.message
    );

    return;
  }

  const { error } =
    await supabaseClient
      .from('competitions')
      .delete()
      .eq('id', id);

  if (error) {
    alert(
      'Delete failed: ' +
      error.message
    );

    return;
  }

  cart =
    store
      .get('nexa_cart', [])
      .filter(
        item =>
          item.id !== String(id)
      );

  store.set(
    'nexa_cart',
    cart
  );

  updateCartCount();

  await loadCompetitionsFromSupabase();

  await adminView();

  toast(
    'Competition deleted'
  );
}


/* =========================================================
   LEGAL PLACEHOLDERS
   ========================================================= */

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
      Final competition terms must be
      reviewed before launch.
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
      A complete privacy notice will be
      required before launch.
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
      Free competitions require no payment.
      Entrants must have a Nexa account and
      complete the competition skill question.
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
      Customer protection, age controls and
      responsible participation information
      will be published before launch.
    </p>
  `
};

function openLegalPage(key) {
  const host =
    $('#legalContent');

  if (!host) return;

  host.innerHTML =
    legalPages[key] ||
    '<p>Page unavailable.</p>';

  openModal('#legalModal');
}


/* =========================================================
   PAGE EVENTS
   ========================================================= */

document.addEventListener(
  'click',
  event => {
    if (
      event.target.matches(
        '[data-close]'
      )
    ) {
      closeModals();
    }

    if (
      event.target.classList
        ?.contains('modal')
    ) {
      closeModals();
    }

    const legal =
      event.target.closest(
        '[data-legal]'
      );

    if (legal) {
      openLegalPage(
        legal.dataset.legal
      );
    }

    const navItem =
      event.target.closest(
        '#nav a, #nav button'
      );

    if (navItem) {
      $('#nav')
        ?.classList
        .remove('open');
    }
  }
);

$('#cartBtn')
  ?.addEventListener(
    'click',
    openCart
  );

$('#accountBtn')
  ?.addEventListener(
    'click',
    async () => {
      await renderAccount(false);

      openModal(
        '#accountModal'
      );
    }
  );

$('#checkoutBtn')
  ?.addEventListener(
    'click',
    checkout
  );

$('#viewAllBtn')
  ?.addEventListener(
    'click',
    () => {
      document
        .querySelector('#draws')
        ?.scrollIntoView({
          behavior: 'smooth'
        });
    }
  );


/* =========================================================
   AUTH CHANGES
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
  async () => {
    await updateAccountLabel();
  }
);


/* =========================================================
   FUNCTIONS USED BY HTML BUTTONS
   ========================================================= */

window.openCart =
  openCart;

window.renderAccount =
  renderAccount;

window.openModal =
  openModal;

window.openSecureAdmin =
  openSecureAdmin;

window.enterFreeCompetition =
  enterFreeCompetition;


/* =========================================================
   START SITE
   ========================================================= */

async function startNexaDraw() {
  updateCartCount();

  await renderWinners();

  await updateAccountLabel();

  await loadCompetitionsFromSupabase();
}

startNexaDraw();
