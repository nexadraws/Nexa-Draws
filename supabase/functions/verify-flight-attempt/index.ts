import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DT = 1 / 120;
const GRAVITY = 1550;
const FLAP = -470;
const SPEED = 220;
const GAP = 170;
const PIPE_W = 86;
const BIRD_X = 210;
const R = 19;
const W = 900;
const H = 520;
const GROUND = 54;
const SPAWN = 1.48;

const seq = [
  .42, .56, .35, .61,
  .47, .31, .53, .39,
  .58, .44, .34, .50,
];

function gateY(i: number) {
  return (
    92 +
    seq[i % seq.length] *
      (H - GROUND - 184)
  );
}

function coinSpec(
  cy: number,
  i: number
) {
  const cycle =
    Math.floor(i / 13);

  const show =
    i % 13 ===
    ((cycle * 5 + 4) % 13);

  const yOffsets = [
    -.88, .76, -.62, .9,
    -.78, .54, .84, -.7,
  ];

  const xOffsets = [
    -118, 0, 112, -64,
    72, 0, -96, 96,
  ];

  const margin = R + 17;
  const reach =
    GAP / 2 - margin;

  const k =
    cycle % yOffsets.length;

  return {
    show,
    y:
      cy +
      yOffsets[k] * reach,
    xOffset:
      xOffsets[k],
  };
}

function simulate(
  taps: number[],
  endTick: number
) {
  let y = H * .48;
  let vy = 0;
  let spawn = .75;
  let score = 0;
  let gi = 0;
  let dead = false;

  const pipes: any[] = [];

  let ti = 0;

  /*
   * Allow two additional physics
   * ticks at the end.
   *
   * This only tolerates the
   * browser/server frame boundary.
   * The server still independently
   * simulates the entire run,
   * collision and score.
   */
  const simulationEnd =
    Math.min(
      endTick + 2,
      120 * 60 * 60
    );

  for (
    let tick = 0;
    tick < simulationEnd;
    tick++
  ) {
    while (
      ti < taps.length &&
      taps[ti] === tick
    ) {
      vy = FLAP;
      ti++;
    }

    vy += GRAVITY * DT;
    y += vy * DT;

    spawn -= DT;

    if (spawn <= 0) {
      const i = gi;
      const cy =
        gateY(gi++);

      const coin =
        coinSpec(cy, i);

      pipes.push({
        x: W + 20,
        cy,
        coinY: coin.y,
        coinXOffset:
          coin.xOffset,
        passed: false,
        coin: coin.show,
      });

      spawn += SPAWN;
    }

    for (const p of pipes) {
      p.x -= SPEED * DT;

      if (p.coin) {
        const cx =
          p.x +
          PIPE_W / 2 +
          p.coinXOffset;

        const cy =
          p.coinY;

        const dx =
          BIRD_X - cx;

        const dy =
          y - cy;

        if (
          dx * dx +
            dy * dy <
          (R + 14) *
            (R + 14)
        ) {
          p.coin = false;
          score += 2;
        }
      }

      if (
        !p.passed &&
        p.x + PIPE_W <
          BIRD_X
      ) {
        p.passed = true;
        score++;
      }
    }

    if (
      y - R < 0 ||
      y + R >
        H - GROUND
    ) {
      dead = true;
      break;
    }

    for (const p of pipes) {
      const within =
        BIRD_X + R > p.x &&
        BIRD_X - R <
          p.x + PIPE_W;

      const top =
        p.cy - GAP / 2;

      const bottom =
        p.cy + GAP / 2;

      if (
        within &&
        (
          y - R < top ||
          y + R > bottom
        )
      ) {
        dead = true;
        break;
      }
    }

    if (dead) {
      break;
    }

    // Retire pipes only after their collision and coin windows have passed.
    // This keeps long-run verification bounded in memory and CPU.
    while (pipes.length && pipes[0].x < -160) {
      pipes.shift();
    }
  }

  return {
    score,
    dead,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: cors,
      }
    );
  }

  try {
    const url =
      Deno.env.get(
        "SUPABASE_URL"
      )!;

    const anon =
      Deno.env.get(
        "SUPABASE_ANON_KEY"
      )!;

    const service =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      )!;

    const auth =
      createClient(
        url,
        anon,
        {
          global: {
            headers: {
              Authorization:
                req.headers.get(
                  "Authorization"
                ) || "",
            },
          },
        }
      );

    const {
      data: { user },
    } =
      await auth.auth.getUser();

    if (!user) {
      throw new Error(
        "Sign in required"
      );
    }

    const body =
      await req.json();

    const {
      attempt_id,
      taps,
      end_tick,
    } = body;

    if (
      !attempt_id ||
      !Array.isArray(taps) ||
      !Number.isInteger(
        end_tick
      )
    ) {
      throw new Error(
        "Invalid replay"
      );
    }

    if (
      taps.length > 20000 ||
      end_tick < 1 ||
      end_tick > 432000
    ) {
      throw new Error(
        "Replay outside limits"
      );
    }

    let prev = -1;

    for (const t of taps) {
      if (
        !Number.isInteger(t) ||
        t < 0 ||
        t > end_tick ||
        t <= prev
      ) {
        throw new Error(
          "Invalid tap sequence"
        );
      }

      prev = t;
    }

    const admin =
      createClient(
        url,
        service
      );

    const {
      data: attempt,
      error: attemptError,
    } =
      await admin
        .from(
          "skill_attempts"
        )
        .select("*")
        .eq(
          "id",
          attempt_id
        )
        .eq(
          "user_id",
          user.id
        )
        .single();

    if (
      attemptError ||
      !attempt
    ) {
      throw new Error(
        "Attempt not found"
      );
    }

    if (
      attempt.status !==
      "started"
    ) {
      throw new Error(
        "Attempt already consumed"
      );
    }

    if (
      attempt.game_version !==
      "flight-v1"
    ) {
      throw new Error(
        "Unsupported game version"
      );
    }

    /*
     * Independently replay the
     * player's inputs.
     */
    const result =
      simulate(
        taps,
        end_tick
      );

    if (!result.dead) {
      console.error(
        "Flight replay did not reproduce collision",
        {
          attempt_id,
          end_tick,
          taps:
            taps.length,
        }
      );

      throw new Error(
        "Run collision could not be reproduced"
      );
    }

    /*
     * Store a hash of the replay
     * for the audit record.
     */
    const replay = {
      taps,
      end_tick,
    };

    const bytes =
      new TextEncoder()
        .encode(
          JSON.stringify(
            replay
          )
        );

    const digest =
      await crypto.subtle
        .digest(
          "SHA-256",
          bytes
        );

    const hash =
      [
        ...new Uint8Array(
          digest
        ),
      ]
        .map(
          (b) =>
            b
              .toString(16)
              .padStart(
                2,
                "0"
              )
        )
        .join("");

    /*
     * Only a still-started
     * attempt can become
     * verified.
     */
    const {
      data: verified,
      error: updateError,
    } =
      await admin
        .from(
          "skill_attempts"
        )
        .update({
          status:
            "verified",

          score:
            result.score,

          replay,

          replay_hash:
            hash,

          submitted_at:
            new Date()
              .toISOString(),

          verified_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "id",
          attempt.id
        )
        .eq(
          "status",
          "started"
        )
        .select(
          "id,status,score"
        )
        .maybeSingle();

    if (updateError) {
      console.error(
        "Flight verification database update failed",
        updateError
      );

      throw new Error(
        "Verified run could not be saved"
      );
    }

    if (!verified) {
      throw new Error(
        "Attempt changed during verification"
      );
    }

    return Response.json(
      {
        success: true,
        score:
          result.score,
      },
      {
        headers: cors,
      }
    );
  } catch (e) {
    const message =
      e instanceof Error
        ? e.message
        : String(e);

    console.error(
      "verify-flight-attempt error:",
      message,
      e
    );

    return Response.json(
      {
        success: false,
        error: message,
      },
      {
        status: 400,
        headers: cors,
      }
    );
  }
});