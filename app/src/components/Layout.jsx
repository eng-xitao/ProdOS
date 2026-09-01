import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import logoFull from "../assets/logo-full.png";
import { hasAccess, ROLE_LABEL, PLAN_UNRESTRICTED_ROLES } from "../lib/permissions";

// ...