/* =====================================================
   AL JEFOON TENTS
   PAYROLL LOGIN
   SERVER-SIDE AUTHENTICATION
===================================================== */

const PAYROLL_AUTH_URL =
    "https://script.google.com/macros/s/AKfycbwzgyq_Eo87WF39DQ0uJXmMsr93nrafAO40jpuXeX-S7aYPhWZm5rCXnlX3HZ4jpdhH/exec";


(function () {

    /*
       Create login screen
    */

    const loginScreen =
        document.createElement("div");

    loginScreen.id =
        "payrollLoginScreen";

    loginScreen.innerHTML = `

        <div style="
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            background:#f4f4f4;
            font-family:Arial,sans-serif;
        ">

            <div style="
                width:360px;
                max-width:90%;
                background:#fff;
                padding:35px;
                border-radius:12px;
                box-shadow:0 8px 30px rgba(0,0,0,.15);
                text-align:center;
            ">

                <div style="
                    font-size:24px;
                    font-weight:bold;
                    margin-bottom:5px;
                ">
                    AL JEFOON TENTS
                </div>

                <div style="
                    font-size:18px;
                    font-weight:bold;
                    margin-bottom:25px;
                ">
                    PAYROLL
                </div>

                <input
                    id="payrollLoginUsername"
                    type="text"
                    placeholder="Username"
                    autocomplete="username"
                    style="
                        width:100%;
                        box-sizing:border-box;
                        padding:12px;
                        margin-bottom:12px;
                        border:1px solid #ccc;
                        border-radius:6px;
                        font-family:Arial,sans-serif;
                        font-size:15px;
                    "
                >

                <input
                    id="payrollLoginPassword"
                    type="password"
                    placeholder="Password"
                    autocomplete="current-password"
                    style="
                        width:100%;
                        box-sizing:border-box;
                        padding:12px;
                        margin-bottom:15px;
                        border:1px solid #ccc;
                        border-radius:6px;
                        font-family:Arial,sans-serif;
                        font-size:15px;
                    "
                >

                <button
                    id="payrollLoginButton"
                    type="button"
                    style="
                        width:100%;
                        padding:12px;
                        border:0;
                        border-radius:6px;
                        background:#fcc224;
                        color:#000;
                        font-weight:bold;
                        font-family:Arial,sans-serif;
                        font-size:16px;
                        cursor:pointer;
                    "
                >
                    LOGIN
                </button>

                <div
                    id="payrollLoginMessage"
                    style="
                        margin-top:15px;
                        min-height:20px;
                        font-size:14px;
                    "
                ></div>

            </div>

        </div>

    `;


    /*
       Hide payroll until login.
    */

    document.documentElement.style.visibility =
        "hidden";


    document.addEventListener(
        "DOMContentLoaded",
        function () {

            document.body.prepend(
                loginScreen
            );

            document.documentElement.style.visibility =
                "visible";

            checkLogin();

        }
    );


    /*
       Check existing login.
    */

    function checkLogin() {

        const loggedIn =
            sessionStorage.getItem(
                "alJefoonPayrollAuthenticated"
            );

        if (loggedIn === "true") {

            loginScreen.style.display =
                "none";

        } else {

            loginScreen.style.display =
                "block";

            document.body.style.overflow =
                "hidden";

        }

    }


    /*
       Login button
    */

    document.addEventListener(
        "click",
        function (event) {

            if (
                event.target.id !==
                "payrollLoginButton"
            ) {
                return;
            }

            login();

        }
    );


    /*
       Enter key support
    */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                document.activeElement &&
                (
                    document.activeElement.id ===
                    "payrollLoginUsername" ||
                    document.activeElement.id ===
                    "payrollLoginPassword"
                )
            ) {

                login();

            }

        }
    );


    /*
       Server-side login
    */

    async function login() {

        const username =
            document.getElementById(
                "payrollLoginUsername"
            ).value.trim();

        const password =
            document.getElementById(
                "payrollLoginPassword"
            ).value;

        const message =
            document.getElementById(
                "payrollLoginMessage"
            );

        const button =
            document.getElementById(
                "payrollLoginButton"
            );


        if (!username || !password) {

            message.textContent =
                "Please enter username and password.";

            return;

        }


        button.disabled = true;

        button.textContent =
            "Checking...";

        message.textContent = "";


        try {

            const response =
                await fetch(
                    PAYROLL_AUTH_URL,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "text/plain;charset=utf-8"
                        },

                        body: JSON.stringify({
                            username:
                                username,

                            password:
                                password
                        })
                    }
                );


            const result =
                await response.json();


            if (result.success) {

                sessionStorage.setItem(
                    "alJefoonPayrollAuthenticated",
                    "true"
                );

                loginScreen.style.display =
                    "none";

                document.body.style.overflow =
                    "";

            } else {

                message.textContent =
                    "Invalid username or password.";

            }

        } catch (error) {

            console.error(error);

            message.textContent =
                "Unable to connect to the login server.";

        }


        button.disabled = false;

        button.textContent =
            "LOGIN";

    }


    /*
       Global logout function.
    */

    window.logoutPayroll =
        function () {

            sessionStorage.removeItem(
                "alJefoonPayrollAuthenticated"
            );

            location.reload();

        };

})();
