import { cloneElement, isValidElement, type ReactNode } from "react";

type ComponentType = ((...args: never[]) => unknown) & { name?: string };

/**
 * Next.js Flight serialization rejects functions passed from Server Components
 * into Client Components. Regular `renderToStaticMarkup` does not, so tests
 * have to walk the tree the same way the RSC payload encoder would.
 */
/** Next awaits async Server Component children; renderToStaticMarkup does not. */
export async function resolveAsyncServerTree(node: ReactNode): Promise<ReactNode> {
  if (node == null || typeof node === "boolean" || typeof node === "string" || typeof node === "number") {
    return node;
  }
  if (Array.isArray(node)) {
    return Promise.all(node.map((child) => resolveAsyncServerTree(child)));
  }
  if (!isValidElement(node)) return node;

  const type = node.type;
  if (typeof type === "function" && type.constructor.name === "AsyncFunction") {
    const resolved = await (type as (props: unknown) => Promise<ReactNode>)(node.props);
    return resolveAsyncServerTree(resolved);
  }

  const props = node.props as { children?: ReactNode };
  if (!Object.prototype.hasOwnProperty.call(props, "children")) return node;
  const children = await resolveAsyncServerTree(props.children);
  return cloneElement(node, undefined, children);
}

export function assertNoFunctionPropsToClientComponents(
  node: ReactNode,
  clientTypes: Iterable<ComponentType>,
  path = "root",
): void {
  const clients = clientTypes instanceof Set ? clientTypes : new Set(clientTypes);
  walk(node, clients, path);
}

function walk(node: ReactNode, clients: Set<ComponentType>, path: string): void {
  if (node == null || typeof node === "boolean" || typeof node === "string" || typeof node === "number") {
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child, index) => walk(child, clients, `${path}[${index}]`));
    return;
  }
  if (!isValidElement(node)) return;

  const type = node.type;
  const props = node.props as Record<string, unknown>;
  if (typeof type === "function" && clients.has(type as ComponentType)) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "children") continue;
      if (typeof value === "function") {
        const name = (type as ComponentType).name || "Anonymous";
        throw new Error(
          `Functions cannot be passed directly to Client Component \`${name}\`. Found \`${key}\` at ${path}. This is the Next.js Flight 500 ("This page couldn't load").`,
        );
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(props, "children")) {
    walk(props.children as ReactNode, clients, `${path}.${typeof type === "function" ? type.name || "Component" : "element"}.children`);
  }
}
