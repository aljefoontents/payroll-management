/* =====================================================
   AL JEFOON TENTS
   PAYROLL SYSTEM
   SCRIPT.JS
   VERSION 2.4
===================================================== */

const EMPLOYEE_KEY = "alJefoonPayrollEmployeesV1";
const TRANSACTION_KEY = "alJefoonPayrollTransactionsV1";
const LEAVE_KEY = "alJefoonPayrollLeaveV1";
const DARK_MODE_KEY = "alJefoonPayrollDarkModeV1";


/* =====================================================
   DATA
===================================================== */

let employees = JSON.parse(
    localStorage.getItem(EMPLOYEE_KEY) || "[]"
);

let transactions = JSON.parse(
    localStorage.getItem(TRANSACTION_KEY) || "[]"
);

let leaveRecords = JSON.parse(
    localStorage.getItem(LEAVE_KEY) || "[]"
);


/* =====================================================
   HELPERS
===================================================== */

const $ = id => document.getElementById(id);


function saveEmployees() {
    localStorage.setItem(
        EMPLOYEE_KEY,
        JSON.stringify(employees)
    );
}


function saveTransactions() {
    localStorage.setItem(
        TRANSACTION_KEY,
        JSON.stringify(transactions)
    );
}


function saveLeave() {
    localStorage.setItem(
        LEAVE_KEY,
        JSON.stringify(leaveRecords)
    );
}


function money(value) {

    return "AED " + (
        Number(value) || 0
    ).toLocaleString("en-AE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}


function number(value) {
    return Number(value) || 0;
}


function today() {

    const d = new Date();

    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );

}


function currentMonth() {

    const d = new Date();

    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0")
    );

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =====================================================
   EMPLOYEE ID GENERATOR
   STARTS AT EMP003
===================================================== */

function generateID() {

    const numbers = employees
        .map(emp => {

            const match = String(
                emp.id || ""
            ).match(/^EMP(\d+)$/);

            return match
                ? parseInt(match[1], 10)
                : 0;

        })
        .filter(n => !isNaN(n));


    const highest = numbers.length
        ? Math.max(...numbers)
        : 2;


    return (
        "EMP" +
        String(highest + 1).padStart(3, "0")
    );

}


/* =====================================================
   NAVIGATION
===================================================== */

document.querySelectorAll(".nav-btn")
    .forEach(button => {

        button.addEventListener("click", () => {

            showSection(
                button.dataset.section
            );

        });

    });


function showSection(sectionID) {

    document.querySelectorAll(".section")
        .forEach(section => {

            section.classList.remove("active");

        });


    const section = $(sectionID);

    if (section) {
        section.classList.add("active");
    }


    document.querySelectorAll(".nav-btn")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.section === sectionID
            );

        });


    const titles = {

        dashboard: "Payroll Dashboard",
        employees: "Employees",
        transactions: "Salary / Advances / Loans",
        leave: "Staff Leave",
        reports: "Monthly Payroll Report"

    };


    if ($("pageTitle")) {

        $("pageTitle").textContent =
            titles[sectionID] || "Payroll";

    }


    if (sectionID === "dashboard") {
        renderDashboard();
    }

    if (sectionID === "employees") {
        renderEmployees();
    }

    if (sectionID === "transactions") {

        populateEmployeeDropdowns();
        renderTransactions();

    }

    if (sectionID === "leave") {
        renderLeave();
    }

    if (sectionID === "reports") {
        renderReport();
    }

}


/* =====================================================
   DARK MODE
===================================================== */

function loadDarkMode() {

    const dark =
        localStorage.getItem(
            DARK_MODE_KEY
        ) === "true";


    if (dark) {

        document.body.classList.add(
            "dark-mode"
        );

    }


    updateDarkModeButton();

}


function toggleDarkMode() {

    document.body.classList.toggle(
        "dark-mode"
    );


    const dark =
        document.body.classList.contains(
            "dark-mode"
        );


    localStorage.setItem(
        DARK_MODE_KEY,
        dark ? "true" : "false"
    );


    updateDarkModeButton();

}


function updateDarkModeButton() {

    const button =
        $("darkModeBtn");


    if (!button) return;


    const dark =
        document.body.classList.contains(
            "dark-mode"
        );


    button.innerHTML = dark
        ? "☀ Light Mode"
        : "☾ Dark Mode";

}


if ($("darkModeBtn")) {

    $("darkModeBtn")
        .addEventListener(
            "click",
            toggleDarkMode
        );

}


loadDarkMode();


/* =====================================================
   CLOCK
===================================================== */

function updateClock() {

    const clock =
        $("clock");


    if (!clock) return;


    const now =
        new Date();


    const date =
        now.toLocaleDateString(
            "en-GB",
            {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );


    const time =
        now.toLocaleTimeString(
            "en-GB",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );


    clock.textContent =
        date + " | " + time;

}


setInterval(
    updateClock,
    1000
);

updateClock();


/* =====================================================
   EMPLOYEE SALARY
===================================================== */

function getEmployeeSalary(employee) {

    return number(
        employee.salary ||
        employee.basicSalary ||
        0
    );

}


function getEmployeeFood(employee) {

    return number(
        employee.foodAllowance ||
        0
    );

}


/* =====================================================
   MONTHLY SALARY PAYMENTS
===================================================== */

function getMonthSalaryPayment(
    employeeID,
    month
) {

    return transactions
        .filter(transaction => {

            return (
                transaction.employeeId === employeeID &&
                transaction.month === month &&
                (
                    transaction.type === "salary" ||
                    transaction.type === "salary_payment"
                )
            );

        })
        .reduce(
            (total, transaction) =>
                total +
                number(transaction.amount),
            0
        );

}


/* =====================================================
   SALARY DETAILS
===================================================== */

function getSalaryDetails(
    employee,
    month
) {

    const salary =
        getEmployeeSalary(employee);


    const paid =
        getMonthSalaryPayment(
            employee.id,
            month
        );


    const pending =
        Math.max(
            salary - paid,
            0
        );


    let status =
        "Pending";


    if (salary <= 0) {

        status =
            "No Salary";

    }
    else if (paid >= salary) {

        status =
            "Fully Paid";

    }
    else if (paid > 0) {

        status =
            "Partially Paid";

    }


    return {

        salary,
        paid,
        pending,
        status

    };

}


/* =====================================================
   LEAVE CHECK
===================================================== */

/*
   IMPORTANT:

   Leave can now be recorded WITHOUT dates.

   If a leave record has:
   - no start date
   - no end date

   it is treated as a general "On Leave"
   record.

   If dates are entered, the system will use
   those dates to determine whether the employee
   was on leave during a particular month.
*/

function isEmployeeOnLeave(
    employeeID,
    month
) {

    return leaveRecords.some(record => {

        if (
            record.employeeId !==
            employeeID
        ) {

            return false;

        }


        const start =
            record.startDate || "";


        const end =
            record.endDate || "";


        /*
           NO DATES:
           General leave record.
        */

        if (!start && !end) {

            return true;

        }


        /*
           ONLY END DATE:
           Treat as leave record beginning
           before / during the selected month.
        */

        if (!start && end) {

            return end >= month + "-01";

        }


        /*
           ONLY START DATE:
           Treat as leave beginning on
           the selected date and continuing.
        */

        if (start && !end) {

            const selectedYear =
                Number(
                    month.substring(0, 4)
                );

            const selectedMonth =
                Number(
                    month.substring(5, 7)
                );


            const monthEnd =
                new Date(
                    selectedYear,
                    selectedMonth,
                    0
                );


            const monthEndString =
                monthEnd.getFullYear() +
                "-" +
                String(
                    monthEnd.getMonth() + 1
                ).padStart(2, "0") +
                "-" +
                String(
                    monthEnd.getDate()
                ).padStart(2, "0");


            return start <= monthEndString;

        }


        /*
           BOTH DATES:
           Normal date range.
        */

        const selectedYear =
            Number(
                month.substring(0, 4)
            );

        const selectedMonth =
            Number(
                month.substring(5, 7)
            );


        const monthStart =
            month + "-01";


        const lastDay =
            new Date(
                selectedYear,
                selectedMonth,
                0
            ).getDate();


        const monthEnd =
            month +
            "-" +
            String(lastDay).padStart(2, "0");


        return (
            start <= monthEnd &&
            end >= monthStart
        );

    });

}


/* =====================================================
   EMPLOYEE MODAL
===================================================== */

if ($("addEmployeeBtn")) {

    $("addEmployeeBtn")
        .addEventListener(
            "click",
            openEmployeeModal
        );

}


function openEmployeeModal() {

    const id =
        generateID();


    openModal(
        "Add Employee",
        `
        <div class="form-grid">

            <div class="form-field">

                <label>Employee ID</label>

                <input
                    type="text"
                    id="employeeID"
                    value="${id}"
                    readonly
                >

            </div>


            <div class="form-field">

                <label>Employee Name *</label>

                <input
                    type="text"
                    id="employeeName"
                    required
                >

            </div>


            <div class="form-field">

                <label>Basic Salary *</label>

                <input
                    type="number"
                    id="employeeSalary"
                    min="0"
                    step="0.01"
                    required
                >

            </div>


            <div class="form-field">

                <label>Food Allowance</label>

                <input
                    type="number"
                    id="employeeFood"
                    min="0"
                    step="0.01"
                    value="0"
                >

            </div>


            <div class="form-field">

                <label>Position</label>

                <input
                    type="text"
                    id="employeePosition"
                >

            </div>


            <div class="form-field">

                <label>Joining Date</label>

                <input
                    type="date"
                    id="employeeJoiningDate"
                    value="${today()}"
                >

            </div>


            <div class="form-field">

                <label>Status</label>

                <select id="employeeStatus">

                    <option value="Active">
                        Active
                    </option>

                    <option value="Inactive">
                        Inactive
                    </option>

                </select>

            </div>

        </div>


        <div class="form-actions">

            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Save Employee
            </button>

        </div>
        `
    );


    $("modalForm").onsubmit =
        function(event) {

            event.preventDefault();

            addEmployee();

        };

}


/* =====================================================
   ADD EMPLOYEE
===================================================== */

function addEmployee() {

    const employee = {

        id:
            $("employeeID").value,

        name:
            $("employeeName")
                .value
                .trim(),

        salary:
            number(
                $("employeeSalary")
                    .value
            ),

        foodAllowance:
            number(
                $("employeeFood")
                    .value
            ),

        position:
            $("employeePosition")
                .value
                .trim(),

        joiningDate:
            $("employeeJoiningDate")
                .value,

        status:
            $("employeeStatus")
                .value,

        createdAt:
            new Date().toISOString()

    };


    if (!employee.name) {

        alert(
            "Please enter the employee name."
        );

        return;

    }


    employees.push(
        employee
    );


    saveEmployees();

    closeModal();

    renderEmployees();

    populateEmployeeDropdowns();

    renderDashboard();

    renderReport();

}


/* =====================================================
   EDIT EMPLOYEE
===================================================== */

function editEmployee(id) {

    const employee =
        employees.find(
            emp =>
                emp.id === id
        );


    if (!employee) return;


    openModal(
        "Edit Employee",
        `
        <div class="form-grid">

            <div class="form-field">

                <label>Employee ID</label>

                <input
                    type="text"
                    value="${escapeHTML(employee.id)}"
                    readonly
                >

            </div>


            <div class="form-field">

                <label>Employee Name *</label>

                <input
                    type="text"
                    id="employeeName"
                    value="${escapeHTML(employee.name)}"
                    required
                >

            </div>


            <div class="form-field">

                <label>Basic Salary *</label>

                <input
                    type="number"
                    id="employeeSalary"
                    value="${getEmployeeSalary(employee)}"
                    min="0"
                    step="0.01"
                    required
                >

            </div>


            <div class="form-field">

                <label>Food Allowance</label>

                <input
                    type="number"
                    id="employeeFood"
                    value="${getEmployeeFood(employee)}"
                    min="0"
                    step="0.01"
                >

            </div>


            <div class="form-field">

                <label>Position</label>

                <input
                    type="text"
                    id="employeePosition"
                    value="${escapeHTML(
                        employee.position || ""
                    )}"
                >

            </div>


            <div class="form-field">

                <label>Joining Date</label>

                <input
                    type="date"
                    id="employeeJoiningDate"
                    value="${employee.joiningDate || ""}"
                >

            </div>


            <div class="form-field">

                <label>Status</label>

                <select id="employeeStatus">

                    <option
                        value="Active"
                        ${
                            employee.status === "Active"
                                ? "selected"
                                : ""
                        }
                    >
                        Active
                    </option>


                    <option
                        value="Inactive"
                        ${
                            employee.status === "Inactive"
                                ? "selected"
                                : ""
                        }
                    >
                        Inactive
                    </option>

                </select>

            </div>

        </div>


        <div class="form-actions">

            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Save Changes
            </button>

        </div>
        `
    );


    $("modalForm").onsubmit =
        function(event) {

            event.preventDefault();


            employee.name =
                $("employeeName")
                    .value
                    .trim();


            employee.salary =
                number(
                    $("employeeSalary")
                        .value
                );


            employee.foodAllowance =
                number(
                    $("employeeFood")
                        .value
                );


            employee.position =
                $("employeePosition")
                    .value
                    .trim();


            employee.joiningDate =
                $("employeeJoiningDate")
                    .value;


            employee.status =
                $("employeeStatus")
                    .value;


            saveEmployees();

            closeModal();

            renderEmployees();

            populateEmployeeDropdowns();

            renderDashboard();

            renderReport();

        };

}


/* =====================================================
   DELETE EMPLOYEE
===================================================== */

function deleteEmployee(id) {

    const employee =
        employees.find(
            emp =>
                emp.id === id
        );


    if (!employee) return;


    if (
        !confirm(
            `Delete ${employee.name} (${employee.id})?`
        )
    ) {

        return;

    }


    employees =
        employees.filter(
            emp =>
                emp.id !== id
        );


    saveEmployees();

    renderEmployees();

    populateEmployeeDropdowns();

    renderDashboard();

    renderReport();

}


/* =====================================================
   EMPLOYEES TABLE
===================================================== */

function renderEmployees() {

    const table =
        $("employeesTable");


    if (!table) return;


    if (!employees.length) {

        table.innerHTML = `

            <tbody>

                <tr>

                    <td
                        colspan="8"
                        class="empty"
                    >
                        No employees added yet.
                    </td>

                </tr>

            </tbody>

        `;

        return;

    }


    table.innerHTML = `

        <thead>

            <tr>

                <th>Employee ID</th>
                <th>Name</th>
                <th>Position</th>
                <th>Basic Salary</th>
                <th>Food Allowance</th>
                <th>Joining Date</th>
                <th>Status</th>
                <th>Actions</th>

            </tr>

        </thead>


        <tbody>

            ${employees.map(employee => `

                <tr>

                    <td>

                        <strong>
                            ${escapeHTML(
                                employee.id
                            )}
                        </strong>

                    </td>


                    <td>
                        ${escapeHTML(
                            employee.name
                        )}
                    </td>


                    <td>
                        ${escapeHTML(
                            employee.position ||
                            "-"
                        )}
                    </td>


                    <td>
                        ${money(
                            getEmployeeSalary(
                                employee
                            )
                        )}
                    </td>


                    <td>
                        ${money(
                            getEmployeeFood(
                                employee
                            )
                        )}
                    </td>


                    <td>
                        ${escapeHTML(
                            employee.joiningDate ||
                            "-"
                        )}
                    </td>


                    <td>
                        ${escapeHTML(
                            employee.status ||
                            "Active"
                        )}
                    </td>


                    <td>

                        <button
                            class="action-btn"
                            onclick="editEmployee('${employee.id}')"
                        >
                            Edit
                        </button>


                        <button
                            class="action-btn"
                            onclick="deleteEmployee('${employee.id}')"
                        >
                            Delete
                        </button>

                    </td>

                </tr>

            `).join("")}

        </tbody>

    `;

}


/* =====================================================
   TRANSACTION MODAL
===================================================== */

if ($("addTransactionBtn")) {

    $("addTransactionBtn")
        .addEventListener(
            "click",
            openTransactionModal
        );

}


function openTransactionModal() {

    if (!employees.length) {

        alert(
            "Please add an employee first."
        );

        return;

    }


    const options =
        employees.map(employee => `

            <option
                value="${employee.id}"
            >

                ${escapeHTML(employee.id)}
                -
                ${escapeHTML(employee.name)}

            </option>

        `).join("");


    openModal(
        "Add Transaction",
        `
        <div class="form-grid">

            <div class="form-field">

                <label>Employee *</label>

                <select
                    id="transactionEmployeeInput"
                    required
                >

                    <option value="">
                        Select Employee
                    </option>

                    ${options}

                </select>

            </div>


            <div class="form-field">

                <label>Date *</label>

                <input
                    type="date"
                    id="transactionDateInput"
                    value="${today()}"
                    required
                >

            </div>


            <div class="form-field">

                <label>Type *</label>

                <select
                    id="transactionTypeInput"
                    required
                >

                    <option value="salary">
                        Salary Payment
                    </option>

                    <option value="advance">
                        Advance
                    </option>

                    <option value="loan">
                        Loan Given
                    </option>

                    <option value="loan_repayment">
                        Loan Repayment
                    </option>

                    <option value="adjustment">
                        Other Adjustment
                    </option>

                </select>

            </div>


            <div class="form-field">

                <label>Amount *</label>

                <input
                    type="number"
                    id="transactionAmountInput"
                    min="0"
                    step="0.01"
                    required
                >

            </div>


            <div class="form-field full">

                <label>Notes</label>

                <textarea
                    id="transactionNotesInput"
                    rows="3"
                ></textarea>

            </div>

        </div>


        <div class="form-actions">

            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Save Transaction
            </button>

        </div>
        `
    );


    $("modalForm").onsubmit =
        function(event) {

            event.preventDefault();

            addTransaction();

        };

}


/* =====================================================
   ADD TRANSACTION
===================================================== */

function addTransaction() {

    const employeeId =
        $("transactionEmployeeInput")
            .value;


    const date =
        $("transactionDateInput")
            .value;


    const type =
        $("transactionTypeInput")
            .value;


    const amount =
        number(
            $("transactionAmountInput")
                .value
        );


    const notes =
        $("transactionNotesInput")
            .value
            .trim();


    if (!employeeId) {

        alert(
            "Please select an employee."
        );

        return;

    }


    if (!date) {

        alert(
            "Please select a date."
        );

        return;

    }


    if (amount <= 0) {

        alert(
            "Please enter a valid amount."
        );

        return;

    }


    transactions.push({

        id:
            Date.now().toString(),

        employeeId,

        date,

        month:
            date.substring(0, 7),

        type,

        amount,

        notes,

        createdAt:
            new Date().toISOString()

    });


    saveTransactions();

    closeModal();

    renderTransactions();

    renderDashboard();

    renderReport();

}


/* =====================================================
   EDIT TRANSACTION
===================================================== */

function editTransaction(id) {

    const transaction =
        transactions.find(
            item =>
                item.id === id
        );


    if (!transaction) {

        alert(
            "Transaction not found."
        );

        return;

    }


    const options =
        employees.map(employee => `

            <option
                value="${employee.id}"
                ${
                    employee.id ===
                    transaction.employeeId
                        ? "selected"
                        : ""
                }
            >

                ${escapeHTML(
                    employee.id
                )}

                -

                ${escapeHTML(
                    employee.name
                )}

            </option>

        `).join("");


    openModal(
        "Edit Transaction",
        `
        <div class="form-grid">

            <div class="form-field">

                <label>Employee *</label>

                <select
                    id="editTransactionEmployee"
                    required
                >

                    ${options}

                </select>

            </div>


            <div class="form-field">

                <label>Date *</label>

                <input
                    type="date"
                    id="editTransactionDate"
                    value="${escapeHTML(
                        transaction.date
                    )}"
                    required
                >

            </div>


            <div class="form-field">

                <label>Type *</label>

                <select
                    id="editTransactionType"
                    required
                >

                    <option
                        value="salary"
                        ${
                            transaction.type === "salary" ||
                            transaction.type === "salary_payment"
                                ? "selected"
                                : ""
                        }
                    >
                        Salary Payment
                    </option>


                    <option
                        value="advance"
                        ${
                            transaction.type === "advance"
                                ? "selected"
                                : ""
                        }
                    >
                        Advance
                    </option>


                    <option
                        value="loan"
                        ${
                            transaction.type === "loan"
                                ? "selected"
                                : ""
                        }
                    >
                        Loan Given
                    </option>


                    <option
                        value="loan_repayment"
                        ${
                            transaction.type === "loan_repayment"
                                ? "selected"
                                : ""
                        }
                    >
                        Loan Repayment
                    </option>


                    <option
                        value="adjustment"
                        ${
                            transaction.type === "adjustment"
                                ? "selected"
                                : ""
                        }
                    >
                        Other Adjustment
                    </option>

                </select>

            </div>


            <div class="form-field">

                <label>Amount *</label>

                <input
                    type="number"
                    id="editTransactionAmount"
                    value="${number(
                        transaction.amount
                    )}"
                    min="0"
                    step="0.01"
                    required
                >

            </div>


            <div class="form-field full">

                <label>Notes</label>

                <textarea
                    id="editTransactionNotes"
                    rows="3"
                >${escapeHTML(
                    transaction.notes || ""
                )}</textarea>

            </div>

        </div>


        <div class="form-actions">

            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Update Transaction
            </button>

        </div>
        `
    );


    $("modalForm").onsubmit =
        function(event) {

            event.preventDefault();

            updateTransaction(id);

        };

}


/* =====================================================
   UPDATE TRANSACTION
===================================================== */

function updateTransaction(id) {

    const transaction =
        transactions.find(
            item =>
                item.id === id
        );


    if (!transaction) return;


    const employeeId =
        $("editTransactionEmployee")
            .value;


    const date =
        $("editTransactionDate")
            .value;


    const type =
        $("editTransactionType")
            .value;


    const amount =
        number(
            $("editTransactionAmount")
                .value
        );


    const notes =
        $("editTransactionNotes")
            .value
            .trim();


    if (!employeeId) {

        alert(
            "Please select an employee."
        );

        return;

    }


    if (!date) {

        alert(
            "Please select a date."
        );

        return;

    }


    if (amount <= 0) {

        alert(
            "Please enter a valid amount."
        );

        return;

    }


    transaction.employeeId =
        employeeId;


    transaction.date =
        date;


    transaction.month =
        date.substring(0, 7);


    transaction.type =
        type;


    transaction.amount =
        amount;


    transaction.notes =
        notes;


    transaction.updatedAt =
        new Date().toISOString();


    saveTransactions();

    closeModal();

    renderTransactions();

    renderDashboard();

    renderReport();

}


/* =====================================================
   TRANSACTION FILTERS
===================================================== */

if ($("transactionMonth")) {

    $("transactionMonth").value =
        currentMonth();


    $("transactionMonth")
        .addEventListener(
            "change",
            renderTransactions
        );

}


if ($("transactionEmployee")) {

    $("transactionEmployee")
        .addEventListener(
            "change",
            renderTransactions
        );

}


if ($("transactionType")) {

    $("transactionType")
        .addEventListener(
            "change",
            renderTransactions
        );

}


/* =====================================================
   EMPLOYEE DROPDOWN
===================================================== */

function populateEmployeeDropdowns() {

    const dropdown =
        $("transactionEmployee");


    if (!dropdown) return;


    const current =
        dropdown.value;


    dropdown.innerHTML = `

        <option value="">
            All Employees
        </option>


        ${employees.map(employee => `

            <option
                value="${employee.id}"
            >

                ${escapeHTML(
                    employee.id
                )}

                -

                ${escapeHTML(
                    employee.name
                )}

            </option>

        `).join("")}

    `;


    if (
        employees.some(
            employee =>
                employee.id === current
        )
    ) {

        dropdown.value =
            current;

    }

}


/* =====================================================
   TRANSACTIONS TABLE
===================================================== */

function renderTransactions() {

    const table =
        $("transactionsTable");


    if (!table) return;


    const month =
        $("transactionMonth")
            ? $("transactionMonth").value
            : "";


    const employeeID =
        $("transactionEmployee")
            ? $("transactionEmployee").value
            : "";


    const type =
        $("transactionType")
            ? $("transactionType").value
            : "";


    let filtered =
        transactions.filter(
            transaction => {

                if (
                    month &&
                    transaction.month !== month
                ) {

                    return false;

                }


                if (
                    employeeID &&
                    transaction.employeeId !==
                    employeeID
                ) {

                    return false;

                }


                if (
                    type &&
                    transaction.type !== type
                ) {

                    return false;

                }


                return true;

            }
        );


    filtered.sort(
        (a, b) =>
            String(b.date)
                .localeCompare(
                    String(a.date)
                )
    );


    if (!filtered.length) {

        table.innerHTML = `

            <tbody>

                <tr>

                    <td
                        colspan="6"
                        class="empty"
                    >
                        No transactions found.
                    </td>

                </tr>

            </tbody>

        `;

        return;

    }


    table.innerHTML = `

        <thead>

            <tr>

                <th>Date</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Notes</th>
                <th>Actions</th>

            </tr>

        </thead>


        <tbody>

            ${filtered.map(transaction => {

                const employee =
                    employees.find(
                        emp =>
                            emp.id ===
                            transaction.employeeId
                    );


                return `

                    <tr>

                        <td>
                            ${escapeHTML(
                                transaction.date
                            )}
                        </td>


                        <td>

                            <strong>
                                ${escapeHTML(
                                    transaction.employeeId
                                )}
                            </strong>

                            <br>

                            ${escapeHTML(
                                employee
                                    ? employee.name
                                    : "Unknown"
                            )}

                        </td>


                        <td>

                            ${formatTransactionType(
                                transaction.type
                            )}

                        </td>


                        <td>

                            ${money(
                                transaction.amount
                            )}

                        </td>


                        <td>

                            ${escapeHTML(
                                transaction.notes ||
                                "-"
                            )}

                        </td>


                        <td>

                            <button
                                class="action-btn"
                                onclick="editTransaction('${transaction.id}')"
                            >
                                Edit
                            </button>


                            <button
                                class="action-btn"
                                onclick="deleteTransaction('${transaction.id}')"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>

                `;

            }).join("")}

        </tbody>

    `;

}


/* =====================================================
   TRANSACTION TYPE
===================================================== */

function formatTransactionType(type) {

    const types = {

        salary:
            "Salary Payment",

        salary_payment:
            "Salary Payment",

        advance:
            "Advance",

        loan:
            "Loan Given",

        loan_repayment:
            "Loan Repayment",

        adjustment:
            "Other Adjustment"

    };


    return (
        types[type] ||
        type ||
        "-"
    );

}


/* =====================================================
   DELETE TRANSACTION
===================================================== */

function deleteTransaction(id) {

    if (
        !confirm(
            "Delete this transaction?"
        )
    ) {

        return;

    }


    transactions =
        transactions.filter(
            transaction =>
                transaction.id !== id
        );


    saveTransactions();

    renderTransactions();

    renderDashboard();

    renderReport();

}


/* =====================================================
   LEAVE
===================================================== */

if ($("addLeaveBtn")) {

    $("addLeaveBtn")
        .addEventListener(
            "click",
            openLeaveModal
        );

}


/* =====================================================
   OPEN LEAVE MODAL
===================================================== */

function openLeaveModal() {

    if (!employees.length) {

        alert(
            "Please add an employee first."
        );

        return;

    }


    const options =
        employees.map(employee => `

            <option
                value="${employee.id}"
            >

                ${escapeHTML(
                    employee.id
                )}

                -

                ${escapeHTML(
                    employee.name
                )}

            </option>

        `).join("");


    openModal(
        "Record Staff Leave",
        `
        <div class="form-grid">

            <div class="form-field">

                <label>Employee *</label>

                <select
                    id="leaveEmployee"
                    required
                >

                    <option value="">
                        Select Employee
                    </option>

                    ${options}

                </select>

            </div>


            <div class="form-field">

                <label>Start Date</label>

                <input
                    type="date"
                    id="leaveStart"
                >

            </div>


            <div class="form-field">

                <label>End Date</label>

                <input
                    type="date"
                    id="leaveEnd"
                >

            </div>


            <div class="form-field">

                <label>Number of Days</label>

                <input
                    type="number"
                    id="leaveDays"
                    min="0"
                    step="1"
                    placeholder="Optional"
                >

            </div>


            <div class="form-field full">

                <label>Reason</label>

                <textarea
                    id="leaveReason"
                    rows="3"
                    placeholder="Optional"
                ></textarea>

            </div>


            <div class="form-field full">

                <small>
                    Date and number of days are optional.
                    You can simply record the employee
                    as being on leave.
                </small>

            </div>

        </div>


        <div class="form-actions">

            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Save Leave
            </button>

        </div>
        `
    );


    $("modalForm").onsubmit =
        function(event) {

            event.preventDefault();

            addLeave();

        };

}


/* =====================================================
   ADD LEAVE
===================================================== */

function addLeave() {

    const employeeId =
        $("leaveEmployee")
            .value;


    const startDate =
        $("leaveStart")
            .value;


    const endDate =
        $("leaveEnd")
            .value;


    const daysInput =
        $("leaveDays")
            ? $("leaveDays").value
            : "";


    const days =
        daysInput === ""
            ? null
            : number(daysInput);


    const reason =
        $("leaveReason")
            .value
            .trim();


    /*
       ONLY EMPLOYEE IS REQUIRED.
    */

    if (!employeeId) {

        alert(
            "Please select an employee."
        );

        return;

    }


    /*
       DATE VALIDATION ONLY IF
       BOTH DATES ARE PROVIDED.
    */

    if (
        startDate &&
        endDate &&
        endDate < startDate
    ) {

        alert(
            "End date cannot be before start date."
        );

        return;

    }


    /*
       NUMBER OF DAYS IS OPTIONAL.
    */

    if (
        days !== null &&
        days < 0
    ) {

        alert(
            "Number of days cannot be negative."
        );

        return;

    }


    leaveRecords.push({

        id:
            Date.now().toString(),

        employeeId,

        startDate:
            startDate || "",

        endDate:
            endDate || "",

        days,

        reason,

        createdAt:
            new Date().toISOString()

    });


    saveLeave();

    closeModal();

    renderLeave();

    renderDashboard();

    renderReport();

}


/* =====================================================
   LEAVE TABLE
===================================================== */

function renderLeave() {

    const table =
        $("leaveTable");


    if (!table) return;


    if (!leaveRecords.length) {

        table.innerHTML = `

            <tbody>

                <tr>

                    <td
                        colspan="7"
                        class="empty"
                    >
                        No leave records found.
                    </td>

                </tr>

            </tbody>

        `;

        return;

    }


    const records =
        [...leaveRecords].sort(
            (a, b) =>
                String(
                    b.startDate || ""
                ).localeCompare(
                    String(
                        a.startDate || ""
                    )
                )
        );


    table.innerHTML = `

        <thead>

            <tr>

                <th>Employee</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>

            </tr>

        </thead>


        <tbody>

            ${records.map(record => {

                const employee =
                    employees.find(
                        emp =>
                            emp.id ===
                            record.employeeId
                    );


                const hasDates =
                    Boolean(
                        record.startDate ||
                        record.endDate
                    );


                let active = true;


                if (
                    record.endDate &&
                    record.endDate < today()
                ) {

                    active = false;

                }


                return `

                    <tr>

                        <td>

                            <strong>
                                ${escapeHTML(
                                    record.employeeId
                                )}
                            </strong>

                            <br>

                            ${escapeHTML(
                                employee
                                    ? employee.name
                                    : "Unknown"
                            )}

                        </td>


                        <td>

                            ${
                                record.startDate
                                    ? escapeHTML(
                                        record.startDate
                                      )
                                    : "-"
                            }

                        </td>


                        <td>

                            ${
                                record.endDate
                                    ? escapeHTML(
                                        record.endDate
                                      )
                                    : "-"
                            }

                        </td>


                        <td>

                            ${
                                record.days !== null &&
                                record.days !== undefined &&
                                record.days !== ""
                                    ? escapeHTML(
                                        record.days
                                      )
                                    : "-"
                            }

                        </td>


                        <td>

                            ${escapeHTML(
                                record.reason ||
                                "-"
                            )}

                        </td>


                        <td>

                            <span class="status ${
                                active
                                    ? "partial"
                                    : "paid"
                            }">

                                ${
                                    hasDates
                                        ? (
                                            active
                                                ? "On Leave"
                                                : "Completed"
                                          )
                                        : "On Leave"
                                }

                            </span>

                        </td>


                        <td>

                            <button
                                class="action-btn"
                                onclick="editLeave('${record.id}')"
                            >
                                Edit
                            </button>


                            <button
                                class="action-btn"
                                onclick="deleteLeave('${record.id}')"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>

                `;

            }).join("")}

        </tbody>

    `;

}


/* =====================================================
   EDIT LEAVE
===================================================== */

function editLeave(id) {

    const record =
        leaveRecords.find(
            item =>
                item.id === id
        );


    if (!record) return;


    const options =
        employees.map(employee => `

            <option
                value="${employee.id}"
                ${
                    employee.id ===
                    record.employeeId
                        ? "selected"
                        : ""
                }
            >

                ${escapeHTML(
                    employee.id
                )}

                -

                ${escapeHTML(
                    employee.name
                )}

            </option>

        `).join("");


    openModal(
        "Edit Staff Leave",
        `
        <div class="form-grid">

            <div class="form-field">

                <label>Employee *</label>

                <select
                    id="editLeaveEmployee"
                    required
                >

                    ${options}

                </select>

            </div>


            <div class="form-field">

                <label>Start Date</label>

                <input
                    type="date"
                    id="editLeaveStart"
                    value="${escapeHTML(
                        record.startDate || ""
                    )}"
                >

            </div>


            <div class="form-field">

                <label>End Date</label>

                <input
                    type="date"
                    id="editLeaveEnd"
                    value="${escapeHTML(
                        record.endDate || ""
                    )}"
                >

            </div>


            <div class="form-field">

                <label>Number of Days</label>

                <input
                    type="number"
                    id="editLeaveDays"
                    min="0"
                    step="1"
                    value="${
                        record.days !== null &&
                        record.days !== undefined
                            ? record.days
                            : ""
                    }"
                    placeholder="Optional"
                >

            </div>


            <div class="form-field full">

                <label>Reason</label>

                <textarea
                    id="editLeaveReason"
                    rows="3"
                    placeholder="Optional"
                >${escapeHTML(
                    record.reason || ""
                )}</textarea>

            </div>

        </div>


        <div class="form-actions">

            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Update Leave
            </button>

        </div>
        `
    );


    $("modalForm").onsubmit =
        function(event) {

            event.preventDefault();

            updateLeave(id);

        };

}


/* =====================================================
   UPDATE LEAVE
===================================================== */

function updateLeave(id) {

    const record =
        leaveRecords.find(
            item =>
                item.id === id
        );


    if (!record) return;


    const employeeId =
        $("editLeaveEmployee")
            .value;


    const startDate =
        $("editLeaveStart")
            .value;


    const endDate =
        $("editLeaveEnd")
            .value;


    const daysValue =
        $("editLeaveDays")
            .value;


    const days =
        daysValue === ""
            ? null
            : number(daysValue);


    const reason =
        $("editLeaveReason")
            .value
            .trim();


    if (!employeeId) {

        alert(
            "Please select an employee."
        );

        return;

    }


    if (
        startDate &&
        endDate &&
        endDate < startDate
    ) {

        alert(
            "End date cannot be before start date."
        );

        return;

    }


    if (
        days !== null &&
        days < 0
    ) {

        alert(
            "Number of days cannot be negative."
        );

        return;

    }


    record.employeeId =
        employeeId;


    record.startDate =
        startDate || "";


    record.endDate =
        endDate || "";


    record.days =
        days;


    record.reason =
        reason;


    record.updatedAt =
        new Date().toISOString();


    saveLeave();

    closeModal();

    renderLeave();

    renderDashboard();

    renderReport();

}


/* =====================================================
   DELETE LEAVE
===================================================== */

function deleteLeave(id) {

    if (
        !confirm(
            "Delete this leave record?"
        )
    ) {

        return;

    }


    leaveRecords =
        leaveRecords.filter(
            record =>
                record.id !== id
        );


    saveLeave();

    renderLeave();

    renderDashboard();

    renderReport();

}


/* =====================================================
   DASHBOARD MONTH
===================================================== */

if ($("dashboardMonth")) {

    $("dashboardMonth").value =
        currentMonth();


    $("dashboardMonth")
        .addEventListener(
            "change",
            renderDashboard
        );

}


/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {

    const month =
        $("dashboardMonth")
            ? (
                $("dashboardMonth").value ||
                currentMonth()
              )
            : currentMonth();


    let totalSalary = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalFood = 0;

    let fullyPaid = 0;
    let partiallyPaid = 0;
    let pendingEmployees = 0;
    let onLeave = 0;


    employees.forEach(employee => {

        const details =
            getSalaryDetails(
                employee,
                month
            );


        totalSalary +=
            details.salary;


        totalPaid +=
            details.paid;


        totalPending +=
            details.pending;


        totalFood +=
            getEmployeeFood(
                employee
            );


        if (
            details.status ===
            "Fully Paid"
        ) {

            fullyPaid++;

        }


        if (
            details.status ===
            "Partially Paid"
        ) {

            partiallyPaid++;

        }


        if (
            details.pending > 0
        ) {

            pendingEmployees++;

        }


        if (
            isEmployeeOnLeave(
                employee.id,
                month
            )
        ) {

            onLeave++;

        }

    });


    const totalLoans =
        transactions
            .filter(
                transaction =>
                    transaction.type ===
                    "loan"
            )
            .reduce(
                (total, transaction) =>
                    total +
                    number(
                        transaction.amount
                    ),
                0
            );


    if ($("statEmployees")) {

        $("statEmployees")
            .textContent =
            employees.length;

    }


    if ($("statSalaries")) {

        $("statSalaries")
            .textContent =
            money(totalSalary);

    }


    if ($("statPaid")) {

        $("statPaid")
            .textContent =
            money(totalPaid);

    }


    if ($("statPending")) {

        $("statPending")
            .textContent =
            money(totalPending);

    }


    if ($("statFood")) {

        $("statFood")
            .textContent =
            money(totalFood);

    }


    if ($("statLoans")) {

        $("statLoans")
            .textContent =
            money(totalLoans);

    }


    if ($("statLeave")) {

        $("statLeave")
            .textContent =
            onLeave;

    }


    if ($("statFullyPaid")) {

        $("statFullyPaid")
            .textContent =
            fullyPaid;

    }


    if ($("statPartiallyPaid")) {

        $("statPartiallyPaid")
            .textContent =
            partiallyPaid;

    }


    if ($("statPendingEmployees")) {

        $("statPendingEmployees")
            .textContent =
            pendingEmployees;

    }


    renderDashboardTable(
        month
    );

}


/* =====================================================
   DASHBOARD TABLE
===================================================== */

function renderDashboardTable(month) {

    const table =
        $("dashboardTable");


    if (!table) return;


    if (!employees.length) {

        table.innerHTML = `

            <tbody>

                <tr>

                    <td
                        colspan="8"
                        class="empty"
                    >
                        No employees added.
                    </td>

                </tr>

            </tbody>

        `;

        return;

    }


    table.innerHTML = `

        <thead>

            <tr>

                <th>Employee</th>
                <th>Salary</th>
                <th>Salary Paid</th>
                <th>Pending</th>
                <th>Food Allowance</th>
                <th>Status</th>
                <th>Leave</th>

            </tr>

        </thead>


        <tbody>

            ${employees.map(employee => {

                const details =
                    getSalaryDetails(
                        employee,
                        month
                    );


                const leave =
                    isEmployeeOnLeave(
                        employee.id,
                        month
                    );


                let statusClass =
                    "pending";


                if (
                    details.status ===
                    "Fully Paid"
                ) {

                    statusClass =
                        "paid";

                }
                else if (
                    details.status ===
                    "Partially Paid"
                ) {

                    statusClass =
                        "partial";

                }


                return `

                    <tr>

                        <td>

                            <strong>
                                ${escapeHTML(
                                    employee.id
                                )}
                            </strong>

                            <br>

                            ${escapeHTML(
                                employee.name
                            )}

                        </td>


                        <td>
                            ${money(
                                details.salary
                            )}
                        </td>


                        <td>
                            ${money(
                                details.paid
                            )}
                        </td>


                        <td>
                            ${money(
                                details.pending
                            )}
                        </td>


                        <td>
                            ${money(
                                getEmployeeFood(
                                    employee
                                )
                            )}
                        </td>


                        <td>

                            <span
                                class="status ${statusClass}"
                            >
                                ${details.status}
                            </span>

                        </td>


                        <td>

                            ${
                                leave
                                    ? `<span class="status partial">On Leave</span>`
                                    : "No"
                            }

                        </td>

                    </tr>

                `;

            }).join("")}

        </tbody>

    `;

}


/* =====================================================
   REPORT MONTH
===================================================== */

if ($("reportMonth")) {

    $("reportMonth").value =
        currentMonth();


    $("reportMonth")
        .addEventListener(
            "change",
            renderReport
        );

}


/* =====================================================
   REPORT ROWS
===================================================== */

function getReportRows(month) {

    return employees.map(employee => {

        const details =
            getSalaryDetails(
                employee,
                month
            );


        return {

            employee,

            salary:
                details.salary,

            paid:
                details.paid,

            pending:
                details.pending,

            status:
                details.status,

            food:
                getEmployeeFood(
                    employee
                ),

            onLeave:
                isEmployeeOnLeave(
                    employee.id,
                    month
                )

        };

    });

}


/* =====================================================
   RENDER REPORT
===================================================== */

function renderReport() {

    const month =
        $("reportMonth")
            ? (
                $("reportMonth").value ||
                currentMonth()
              )
            : currentMonth();


    const rows =
        getReportRows(
            month
        );


    renderReportSummary(
        rows
    );


    renderReportTable(
        rows
    );

}


/* =====================================================
   REPORT SUMMARY
===================================================== */

function renderReportSummary(rows) {

    const summary =
        $("reportSummary");


    if (!summary) return;


    const salary =
        rows.reduce(
            (total, row) =>
                total +
                row.salary,
            0
        );


    const paid =
        rows.reduce(
            (total, row) =>
                total +
                row.paid,
            0
        );


    const pending =
        rows.reduce(
            (total, row) =>
                total +
                row.pending,
            0
        );


    const food =
        rows.reduce(
            (total, row) =>
                total +
                row.food,
            0
        );


    const fullyPaid =
        rows.filter(
            row =>
                row.status ===
                "Fully Paid"
        ).length;


    const partial =
        rows.filter(
            row =>
                row.status ===
                "Partially Paid"
        ).length;


    const pendingCount =
        rows.filter(
            row =>
                row.pending > 0
        ).length;


    summary.innerHTML = `

        <div class="summary-box">

            <span>
                Total Salary
            </span>

            <strong>
                ${money(salary)}
            </strong>

        </div>


        <div class="summary-box">

            <span>
                Salary Paid
            </span>

            <strong>
                ${money(paid)}
            </strong>

        </div>


        <div class="summary-box">

            <span>
                Pending Salary
            </span>

            <strong>
                ${money(pending)}
            </strong>

        </div>


        <div class="summary-box">

            <span>
                Food Allowance
            </span>

            <strong>
                ${money(food)}
            </strong>

        </div>


        <div class="summary-box">

            <span>
                Fully Paid
            </span>

            <strong>
                ${fullyPaid}
            </strong>

        </div>


        <div class="summary-box">

            <span>
                Partially Paid
            </span>

            <strong>
                ${partial}
            </strong>

        </div>


        <div class="summary-box">

            <span>
                Pending Employees
            </span>

            <strong>
                ${pendingCount}
            </strong>

        </div>

    `;

}


/* =====================================================
   REPORT TABLE
===================================================== */

function renderReportTable(rows) {

    const table =
        $("reportTable");


    if (!table) return;


    if (!rows.length) {

        table.innerHTML = `

            <tbody>

                <tr>

                    <td
                        colspan="9"
                        class="empty"
                    >
                        No employees found.
                    </td>

                </tr>

            </tbody>

        `;

        return;

    }


    table.innerHTML = `

        <thead>

            <tr>

                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Basic Salary</th>
                <th>Salary Paid</th>
                <th>Pending Salary</th>
                <th>Food Allowance</th>
                <th>Salary Status</th>
                <th>Leave</th>

            </tr>

        </thead>


        <tbody>

            ${rows.map(row => {

                let statusClass =
                    "pending";


                if (
                    row.status ===
                    "Fully Paid"
                ) {

                    statusClass =
                        "paid";

                }
                else if (
                    row.status ===
                    "Partially Paid"
                ) {

                    statusClass =
                        "partial";

                }


                return `

                    <tr
                        data-report-status="${getPrintStatus(row)}"
                    >

                        <td>

                            <strong>
                                ${escapeHTML(
                                    row.employee.id
                                )}
                            </strong>

                        </td>


                        <td>
                            ${escapeHTML(
                                row.employee.name
                            )}
                        </td>


                        <td>
                            ${money(
                                row.salary
                            )}
                        </td>


                        <td>
                            ${money(
                                row.paid
                            )}
                        </td>


                        <td>

                            <strong>
                                ${money(
                                    row.pending
                                )}
                            </strong>

                        </td>


                        <td>
                            ${money(
                                row.food
                            )}
                        </td>


                        <td>

                            <span
                                class="status ${statusClass}"
                            >
                                ${escapeHTML(
                                    row.status
                                )}
                            </span>

                        </td>


                        <td>

                            ${
                                row.onLeave
                                    ? `<span class="status partial">On Leave</span>`
                                    : "No"
                            }

                        </td>

                    </tr>

                `;

            }).join("")}

        </tbody>

    `;

}


/* =====================================================
   REPORT STATUS
===================================================== */

function getPrintStatus(row) {

    if (row.onLeave) {

        return "leave";

    }


    if (
        row.status ===
        "Fully Paid"
    ) {

        return "paid";

    }


    if (
        row.status ===
        "Partially Paid"
    ) {

        return "partial";

    }


    if (
        row.pending > 0
    ) {

        return "pending";

    }


    return "other";

}


/* =====================================================
   PRINT FILTER
===================================================== */

function getSelectedPrintFilter() {

    const selected =
        document.querySelector(
            'input[name="printFilter"]:checked'
        );


    return selected
        ? selected.value
        : "all";

}


function getPrintFilterName(filter) {

    const names = {

        all:
            "All Employees",

        pending:
            "Pending Salaries Only",

        partial:
            "Partially Paid Only",

        paid:
            "Fully Paid Only",

        leave:
            "Employees on Leave"

    };


    return (
        names[filter] ||
        "All Employees"
    );

}


/* =====================================================
   PRINT REPORT
===================================================== */

if ($("printReportBtn")) {

    $("printReportBtn")
        .addEventListener(
            "click",
            printReport
        );

}


function printReport() {

    const month =
        $("reportMonth")
            ? (
                $("reportMonth").value ||
                currentMonth()
              )
            : currentMonth();


    const filter =
        getSelectedPrintFilter();


    const rows =
        getReportRows(
            month
        );


    let filteredRows =
        rows;


    if (
        filter ===
        "pending"
    ) {

        filteredRows =
            rows.filter(
                row =>
                    row.pending > 0
            );

    }


    if (
        filter ===
        "partial"
    ) {

        filteredRows =
            rows.filter(
                row =>
                    row.status ===
                    "Partially Paid"
            );

    }


    if (
        filter ===
        "paid"
    ) {

        filteredRows =
            rows.filter(
                row =>
                    row.status ===
                    "Fully Paid"
            );

    }


    if (
        filter ===
        "leave"
    ) {

        filteredRows =
            rows.filter(
                row =>
                    row.onLeave
            );

    }


    if ($("printMonth")) {

        $("printMonth")
            .textContent =
            "Month: " +
            formatMonth(month);

    }


    if ($("printFilter")) {

        $("printFilter")
            .textContent =
            "Report: " +
            getPrintFilterName(
                filter
            );

    }


    const reportTable =
        $("reportTable");


    if (!reportTable) return;


    const allRows =
        reportTable.querySelectorAll(
            "tbody tr"
        );


    allRows.forEach(row => {

        row.classList.remove(
            "print-hidden"
        );

    });


    const allowedIDs =
        new Set(
            filteredRows.map(
                row =>
                    row.employee.id
            )
        );


    allRows.forEach(row => {

        const id =
            row.children[0]
                ? row.children[0]
                    .textContent
                    .trim()
                : "";


        if (
            filter !== "all" &&
            !allowedIDs.has(id)
        ) {

            row.classList.add(
                "print-hidden"
            );

        }

    });


    if (
        filter !== "all" &&
        filteredRows.length === 0
    ) {

        alert(
            "There are no employees matching this print option for " +
            formatMonth(month) +
            "."
        );


        allRows.forEach(row => {

            row.classList.remove(
                "print-hidden"
            );

        });


        return;

    }


    setTimeout(
        () => window.print(),
        100
    );


    window.onafterprint =
        function() {

            allRows.forEach(row => {

                row.classList.remove(
                    "print-hidden"
                );

            });

        };

}


/* =====================================================
   FORMAT MONTH
===================================================== */

function formatMonth(month) {

    if (!month) return "";


    const parts =
        month.split("-");


    if (
        parts.length !== 2
    ) {

        return month;

    }


    const date =
        new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            1
        );


    return date.toLocaleDateString(
        "en-GB",
        {
            month: "long",
            year: "numeric"
        }
    );

}


/* =====================================================
   MODAL
===================================================== */

function openModal(
    title,
    content
) {

    const modal =
        $("modal");


    const modalTitle =
        $("modalTitle");


    const form =
        $("modalForm");


    if (
        !modal ||
        !form
    ) {

        alert(
            "Modal elements are missing from index.html."
        );

        return;

    }


    if (modalTitle) {

        modalTitle.textContent =
            title;

    }


    form.innerHTML =
        content;


    modal.classList.remove(
        "hidden"
    );

}


function closeModal() {

    const modal =
        $("modal");


    if (modal) {

        modal.classList.add(
            "hidden"
        );

    }

}


if ($("closeModal")) {

    $("closeModal")
        .addEventListener(
            "click",
            closeModal
        );

}


if ($("modal")) {

    $("modal").addEventListener(
        "click",
        event => {

            if (
                event.target ===
                $("modal")
            ) {

                closeModal();

            }

        }
    );

}


/* =====================================================
   INITIALIZE
===================================================== */

function initialize() {

    if ($("dashboardMonth")) {

        $("dashboardMonth").value =
            currentMonth();

    }


    if ($("transactionMonth")) {

        $("transactionMonth").value =
            currentMonth();

    }


    if ($("reportMonth")) {

        $("reportMonth").value =
            currentMonth();

    }


    populateEmployeeDropdowns();

    renderEmployees();

    renderTransactions();

    renderLeave();

    renderDashboard();

    renderReport();

}


initialize();
